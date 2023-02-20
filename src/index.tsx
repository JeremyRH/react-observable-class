import { useEffect, useReducer, useRef } from "react";
import { scheduleCallbacks } from "./callbacksQueue";
import type { CB } from "./callbacksQueue";

const hasOwn = (obj: any, prop: PropertyKey) =>
  Object.prototype.hasOwnProperty.call(obj, prop);
const observersKey = Symbol.for("observable_observersKey_v1");

const proxyTraps = {
  set(target: any, prop: PropertyKey, newValue: unknown, receiver: unknown) {
    if (!Object.is(target[prop], newValue)) {
      scheduleCallbacks(target[observersKey]);
    }
    return Reflect.set(target, prop, newValue, receiver);
  },
  defineProperty(target: any, prop: PropertyKey, descriptor: any) {
    // Only support descriptor.value, descriptor.get has too many potential issues.
    if (
      hasOwn(descriptor, "value") &&
      !Object.is(target[prop], descriptor.value)
    ) {
      scheduleCallbacks(target[observersKey]);
    }
    return Reflect.defineProperty(target, prop, descriptor);
  },
  deleteProperty(target: any, prop: PropertyKey) {
    if (target[prop] !== undefined) {
      scheduleCallbacks(target[observersKey]);
    }
    return Reflect.deleteProperty(target, prop);
  },
};

export class Observable {
  [observersKey] = new Set<CB>();

  constructor() {
    if (this.constructor === Observable) {
      throw new TypeError(
        "Observable is an abstract class and can't be instantiated"
      );
    }
    return new Proxy(this, proxyTraps);
  }
}

function observablesArgsCheck(
  fnName: string,
  observables: [Observable, ...Observable[]]
) {
  if (!observables.length) {
    throw new TypeError(`${fnName} was called without observables`);
  }
  if (observables.some((o) => !o[observersKey])) {
    throw new TypeError(`${fnName} was called with non-observables`);
  }
}

export function forceNotify(...observables: [Observable, ...Observable[]]) {
  observablesArgsCheck("forceNotify", observables);
  for (const o of observables) {
    scheduleCallbacks(o[observersKey]);
  }
}

export function useObservables(...observables: [Observable, ...Observable[]]) {
  observablesArgsCheck("useObservables", observables);
  const [, forceUpdate] = useReducer((c) => c + 1, 0);

  useEffect(() => {
    observables.forEach((o) => {
      o[observersKey].add(forceUpdate);
    });
    return () => {
      observables.forEach((o) => {
        o[observersKey].delete(forceUpdate);
      });
    };
  }, observables);
}

export function useCreateObservables<
  T extends Observable | [Observable, ...Observable[]]
>(getInitialObservables: () => T): T {
  if (typeof getInitialObservables !== "function") {
    throw new TypeError(
      "useCreateObservables was called with something other than a function"
    );
  }
  const observablesRef = useRef<T>();
  if (!observablesRef.current) {
    observablesRef.current = getInitialObservables();
  }
  const result = observablesRef.current;
  if (Array.isArray(result)) {
    useObservables(...(result as unknown as [Observable]));
  } else {
    useObservables(result);
  }
  return result;
}
