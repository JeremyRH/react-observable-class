# react-observable-class

React state management using classes. Similar to [MobX](https://mobx.js.org/README.html) but reduced to the core features.

## Get started

Install as a dependency.

```sh
npm install react-observable-class
```

## API

### `Observable`

```ts
class Observable {
  [observersKey]: Set<() => any>;
  constructor();
}
```

`Observable` is the base class to extend from.

```js
import { Observable } from "react-observable-class";

class ToDoItem extends Observable {
  completed = false;

  constructor(description = '') {
    super();
    this.description = description;
  }

  toggle() {
    this.completed = !this.completed;
  }
}

// Behaves exactly like a normal class instance.
const item = new ToDoItem("buy apples");
item.description = "buy green apples";
item.toggle();
console.log(JSON.stringify(item));
// {"completed":true,"description":"buy green apples"}
```

<details>
<summary>Details</summary>

The `Observable` base class makes the created instance a [Proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy) with traps to detect changes to top-level properties.
"Top-level properties" are properties directly on the instance. `this.object.value = 'new value'` will not be detected as a change. Either replace the whole object or use `forceNotify` (see below).

There are no base methods or properties other than a Symbol key for storing callbacks when top-level properties change.

When a top-level property changes (according to [`Object.is`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is)), callbacks are scheduled to be called using [`Promise.then`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/then).
This means callbacks are called asynchronously. The instance is still updated synchronously, just callbacks are called asynchronously.

Callbacks are also batched. They are scheduled to be called once even if subscribed to multiple changed observables.

</details>

<br />

### `useObservables`

```ts
function useObservables(...observables: [Observable, ...Observable[]]): void;
```

`useObservables` is a React hook that causes a re-render when observable instances change.

```js
import { Observable, useObservables } from "react-observable-class";

class O extends Observable {
  value = '';
}
const obs = new O();

function Input() {
  useObservables(obs);
  return (
    <input
      value={obs.value}
      onChange={(e) => obs.value = e.target.value}
    />
  );
}
```

<details>
<summary>Details</summary>

Can be called with one or more observable instances: `useObservables(obs1, obs2, ...etc)`.

Observable instance can be created at the module/global scope and shared between components. This is useful to sync external state with a component.

Changes to nested properties are not observed. If the nested object is an observable, it can be observed manually:

```js
class Child extends Observable {
  value = '';
}
class Parent extends Observable {
  value = '';
  child = new Child();
}

const parent = new Parent();

function Component() {
  // parent.child is also an observable and must be specified
  // if the component wants to re-render when it changes.
  useObservables(parent, parent.child);
  return ...
}
```

</details>

<br />

### `useCreateObservables`

```ts
function useCreateObservables<
  T extends Observable | [Observable, ...Observable[]]
>(getInitialObservables: () => T): T;
```

`useCreateObservables` is a React hook that creates observable instances and causes a re-render when these instances change.

```js
import { Observable, useCreateObservables } from "react-observable-class";

class O extends Observable {
  value = '';
}

function Input() {
  const obs = useCreateObservables(() => new O());
  return (
    <input
      value={obs.value}
      onChange={(e) => obs.value = e.target.value}
    />
  );
}
```

<details>
<summary>Details</summary>

Can create one or more observable instances: `const [o1, o2] = useCreateObservables(() => [new O(), new O()])`.

This hook is provided to make "local" or "component scoped" state easier to use. Calls `useObservables` internally.

</details>

<br />

### `forceNotify`

```ts
function forceNotify(...observables: [Observable, ...Observable[]]): void;
```

`forceNotify` is a function that accepts any number of observables and schedules their callbacks to be called. This forces a re-render for components using `useObservers`.

```js
import { Observable, forceNotify } from "react-observable-class";

class O extends Observable {
  array = [];
  pushToArray(v) {
    this.array.push(v);
    forceNotify(this);
  }
}
```

<details>
<summary>Details</summary>

Useful for making changes to nested properties without creating a copy of the object.

</details>

<br />

## Contributing

### Install dependencies

```sh
npm install
```

### Build library

```sh
npm run build
```

### Run tests

```sh
npm run test
```

### Format code

```sh
npm run format
```

### Commits

Use [conventional commits](https://www.conventionalcommits.org/en/v1.0.0/) to allow automatic versioned releases.

- `fix:` represents bug fixes, and correlates to a SemVer patch.
- `feat:` represents a new feature, and correlates to a SemVer minor.
- `feat!:`, or `fix!:`, `refactor!:`, etc., represent a breaking change (indicated by the !) and will result in a SemVer major.

### Publishing

The automated [release-please](https://github.com/googleapis/release-please) PR to the main branch can be merged to deploy a release.
