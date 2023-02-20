import * as React from "react";
import { render, cleanup, screen, within } from "@testing-library/react";
import {
  Observable,
  forceNotify,
  useObservables,
  useCreateObservables,
} from "./index";

const observersKey = Symbol.for("observable_observersKey_v1");

describe("Observable", () => {
  test("allow child class instances", () => {
    class O extends Observable {}
    expect(new O()).toBeInstanceOf(Observable);
  });

  test("throw when instantiated directly", () => {
    expect(() => new Observable()).toThrowError(
      "Observable is an abstract class and can't be instantiated"
    );
  });

  test("allow getting/setting properties", () => {
    class O extends Observable {
      prop = 1;
    }
    const obs = new O();
    expect(obs.prop).toBe(1);
    obs.prop++;
    expect(obs.prop).toBe(2);
    (obs as any).newProp = 3;
    expect((obs as any).newProp).toBe(3);
  });

  test("allow deleting properties", () => {
    class O extends Observable {
      prop = 1;
    }
    const obs = new O();
    expect(obs).toHaveProperty("prop");
    delete (obs as any).prop;
    expect(obs).not.toHaveProperty("prop");
  });

  test("allow Object.defineProperty", () => {
    class O extends Observable {}
    const obs = new O();
    Object.defineProperty(obs, "prop", { value: 1 });
    expect((obs as any).prop).toBe(1);
  });

  test("correctly JSON.stringify", () => {
    class O extends Observable {
      prop = 1;
    }
    const obs = new O();
    expect(JSON.stringify(obs)).toBe(JSON.stringify({ prop: 1 }));
  });

  test("call observers when setting a value", async () => {
    class O extends Observable {
      prop = 1;
    }
    const obs = new O();
    const observer = jest.fn();
    obs[observersKey].add(observer);
    obs.prop++;
    // Observers are called asynchronously.
    await new Promise((r) => setTimeout(r));
    expect(observer).toBeCalledTimes(1);
  });

  test("call observers when deleting a value", async () => {
    class O extends Observable {
      prop = 1;
    }
    const obs = new O();
    const observer = jest.fn();
    obs[observersKey].add(observer);
    delete (obs as any).prop;
    // Observers are called asynchronously.
    await new Promise((r) => setTimeout(r));
    expect(observer).toBeCalledTimes(1);
  });

  test("call observers when calling Object.defineProperty with a value descriptor", async () => {
    class O extends Observable {}
    const obs = new O();
    const observer = jest.fn();
    obs[observersKey].add(observer);
    Object.defineProperty(obs, "prop", { value: 1 });
    // Observers are called asynchronously.
    await new Promise((r) => setTimeout(r));
    expect(observer).toBeCalledTimes(1);
  });

  test("batches observer calls when setting values multiple times", async () => {
    class O extends Observable {
      prop1 = 1;
      prop2 = 2;
    }
    const obs = new O();
    const observer = jest.fn();
    obs[observersKey].add(observer);
    obs.prop1++;
    obs.prop1++;
    obs.prop2++;
    obs.prop2++;
    // Observers are called asynchronously.
    await new Promise((r) => setTimeout(r));
    expect(observer).toBeCalledTimes(1);
  });

  test("call multiple observers when setting a value", async () => {
    class O extends Observable {
      prop = 1;
    }
    const obs = new O();
    const observer1 = jest.fn();
    const observer2 = jest.fn();
    obs[observersKey].add(observer1);
    obs[observersKey].add(observer2);
    obs.prop++;
    // Observers are called asynchronously.
    await new Promise((r) => setTimeout(r));
    expect(observer1).toBeCalledTimes(1);
    expect(observer2).toBeCalledTimes(1);
  });
});

describe("forceNotify", () => {
  test("call observers when forceNotify is called", async () => {
    class O extends Observable {}
    const obs = new O();
    const observer = jest.fn();
    obs[observersKey].add(observer);
    forceNotify(obs);
    // Observers are called asynchronously.
    await new Promise((r) => setTimeout(r));
    expect(observer).toBeCalledTimes(1);
  });

  test("batches observer calls when forceNotify is called multiple times", async () => {
    class O extends Observable {}
    const obs1 = new O();
    const obs2 = new O();
    const observer1 = jest.fn();
    const observer2 = jest.fn();
    obs1[observersKey].add(observer1);
    obs1[observersKey].add(observer2);
    obs2[observersKey].add(observer1);
    obs2[observersKey].add(observer2);
    forceNotify(obs1, obs2);
    forceNotify(obs1, obs2);
    // Observers are called asynchronously.
    await new Promise((r) => setTimeout(r));
    expect(observer1).toBeCalledTimes(1);
    expect(observer2).toBeCalledTimes(1);
  });

  test("throw when called with non-observables", () => {
    expect(() => (forceNotify as any)()).toThrowError(
      "forceNotify was called without observables"
    );
    expect(() => forceNotify({} as Observable)).toThrowError(
      "forceNotify was called with non-observables"
    );
  });
});

type CompProps = React.ComponentProps<"div"> & {
  renderCount: number;
  observables: [Observable, ...Observable[]];
};

function Comp({ renderCount, observables, ...props }: CompProps) {
  return (
    <div {...props}>
      <div>Render count: {renderCount}</div>
      {observables.map((o, i) => (
        <pre key={i}>{JSON.stringify(o)}</pre>
      ))}
    </div>
  );
}

describe("useObservables", () => {
  beforeEach(() => {
    cleanup();
  });

  function UOComp(props: Omit<CompProps, "renderCount">) {
    const renderCountRef = React.useRef(1);
    useObservables(...props.observables);
    return <Comp {...props} renderCount={renderCountRef.current++} />;
  }

  test("re-render when observable changes", async () => {
    class O extends Observable {
      prop = 1;
    }
    const obs = new O();
    render(<UOComp observables={[obs]} />);
    screen.getByText('{"prop":1}');
    obs.prop++;
    // Updates render asynchronously.
    await screen.findByText('{"prop":2}');
  });

  test("re-render multiple components when observable changes", async () => {
    class O extends Observable {
      prop = 1;
    }
    const obs = new O();
    render(
      <>
        <UOComp data-testid="one" observables={[obs]} />
        <UOComp data-testid="two" observables={[obs]} />
      </>
    );
    within(screen.getByTestId("one")).getByText('{"prop":1}');
    within(screen.getByTestId("two")).getByText('{"prop":1}');
    obs.prop++;
    // Updates render asynchronously.
    await within(screen.getByTestId("one")).findByText('{"prop":2}');
    within(screen.getByTestId("two")).getByText('{"prop":2}');
  });

  test("re-render component subscribed to multiple observables", async () => {
    class O1 extends Observable {
      o1 = 1;
    }
    class O2 extends Observable {
      o2 = 1;
    }
    const obs1 = new O1();
    const obs2 = new O2();
    render(<UOComp observables={[obs1, obs2]} />);
    screen.getByText('{"o1":1}');
    screen.getByText('{"o2":1}');
    obs1.o1++;
    // Updates render asynchronously.
    await screen.findByText('{"o1":2}');
    screen.getByText('{"o2":1}');
    obs2.o2++;
    await screen.findByText('{"o2":2}');
    screen.getByText('{"o1":2}');
  });

  test("re-render once when multiple observables change", async () => {
    class O extends Observable {
      prop = 1;
    }
    const obs1 = new O();
    const obs2 = new O();
    render(<UOComp observables={[obs1, obs2]} />);
    screen.getAllByText('{"prop":1}');
    screen.getByText("Render count: 1");
    obs1.prop++;
    obs1.prop++;
    obs2.prop++;
    obs2.prop++;
    // Updates render asynchronously.
    await screen.findAllByText('{"prop":3}');
    screen.getByText("Render count: 2");
  });

  test("remove observers when unmounted", async () => {
    class O extends Observable {}
    const obs = new O();
    const { rerender } = render(<UOComp observables={[obs]} />);
    expect(obs[observersKey].size).toBe(1);
    rerender(<div />);
    expect(obs[observersKey].size).toBe(0);
  });

  test("throw when called with non-observables", async () => {
    expect(() => (useObservables as any)()).toThrowError(
      "useObservables was called without observables"
    );
    expect(() => useObservables({} as Observable)).toThrowError(
      "useObservables was called with non-observables"
    );
  });
});

describe("useCreateObservables", () => {
  beforeEach(() => {
    cleanup();
  });

  type UCOProps = React.ComponentProps<"div"> & {
    getInitialObservables: Parameters<typeof useCreateObservables>[0];
  };

  function UCOComp({ getInitialObservables, ...props }: UCOProps) {
    const renderCountRef = React.useRef(1);
    let observables = useCreateObservables(getInitialObservables) as [
      Observable,
      ...Observable[]
    ];
    observables = Array.isArray(observables) ? observables : [observables];
    return (
      <Comp
        {...props}
        observables={observables}
        renderCount={renderCountRef.current++}
      />
    );
  }

  test("uses observables", () => {
    class O extends Observable {
      prop = 1;
    }
    render(<UCOComp getInitialObservables={() => new O()} />);
    screen.getByText('{"prop":1}');
  });

  test("uses multiple observables", () => {
    class O1 extends Observable {
      o1 = 1;
    }
    class O2 extends Observable {
      o2 = 1;
    }
    render(<UCOComp getInitialObservables={() => [new O1(), new O2()]} />);
    screen.getByText('{"o1":1}');
    screen.getByText('{"o2":1}');
  });

  test("calls getInitialObservables once", () => {
    class O extends Observable {
      prop = 1;
    }
    const getInitialObservables1 = jest.fn(() => new O());
    const getInitialObservables2 = jest.fn(() => new O());
    const { rerender } = render(
      <UCOComp getInitialObservables={getInitialObservables1} />
    );
    // Same or different functions should not cause getInitialObservables to be called again.
    rerender(<UCOComp getInitialObservables={getInitialObservables1} />);
    rerender(<UCOComp getInitialObservables={getInitialObservables2} />);
    expect(getInitialObservables1).toBeCalledTimes(1);
    expect(getInitialObservables2).toBeCalledTimes(0);
  });

  test("re-renders when observable changes", async () => {
    class O extends Observable {
      prop = 1;
    }
    const obs = new O();
    render(<UCOComp getInitialObservables={() => obs} />);
    screen.getByText('{"prop":1}');
    obs.prop++;
    await screen.findByText('{"prop":2}');
  });

  test("throws when not called with a function", () => {
    expect(() => (useCreateObservables as any)({})).toThrowError(
      "useCreateObservables was called with something other than a function"
    );
  });
});
