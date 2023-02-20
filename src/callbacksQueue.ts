export type CB = () => any;

const promise = Promise.resolve();
const callacksQueue = new Set<Set<CB>>();
const calledCallbacks = new Set<CB>();

function callCallback(callback: CB) {
  if (calledCallbacks.has(callback)) {
    return;
  }
  calledCallbacks.add(callback);
  try {
    callback();
  } catch (error) {
    console.error(error);
  }
}

export function scheduleCallbacks(callbackSet: Set<CB>) {
  const noPending = callacksQueue.size === 0;
  callacksQueue.add(callbackSet);

  if (noPending) {
    promise.then(() => {
      callacksQueue.forEach((cbSet) => {
        cbSet.forEach(callCallback);
      });
      calledCallbacks.clear();
      callacksQueue.clear();
    });
  }
}
