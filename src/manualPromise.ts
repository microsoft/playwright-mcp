export class ManualPromise<T = void> extends Promise<T> {
  private readonly _resolve!: (t: T) => void;
  private readonly _reject!: (e: Error) => void;
  private _isDone: boolean;
  constructor() {
    let resolve!: (t: T) => void;
    let reject!: (e: Error) => void;
    super((res, rej) => {
      resolve = res;
      reject = rej;
    });
    this._isDone = false;
    this._resolve = resolve;
    this._reject = reject;
  }
  isDone() {
    return this._isDone;
  }
  resolve(t: T) {
    this._isDone = true;
    this._resolve(t);
  }
  reject(e: Error) {
    this._isDone = true;
    this._reject(e);
  }
  static override get [Symbol.species]() {
    return Promise;
  }
  override get [Symbol.toStringTag]() {
    return 'ManualPromise';
  }
}
export class LongStandingScope {
  private _terminateError: Error | undefined;
  private _closeError: Error | undefined;
  private readonly _terminatePromises = new Map<
    ManualPromise<Error>,
    string[]
  >();
  private _isClosed = false;
  reject(error: Error) {
    this._isClosed = true;
    this._terminateError = error;
    for (const p of this._terminatePromises.keys()) {
      p.resolve(error);
    }
  }
  close(error: Error) {
    this._isClosed = true;
    this._closeError = error;
    for (const [p, frames] of this._terminatePromises) {
      p.resolve(cloneError(error, frames));
    }
  }
  isClosed() {
    return this._isClosed;
  }
  static raceMultiple<T>(
    scopes: LongStandingScope[],
    promise: Promise<T>
  ): Promise<T> {
    return Promise.race(scopes.map((s) => s.race(promise)));
  }
  race<T>(promise: Promise<T> | Promise<T>[]): Promise<T> {
    return this._race(Array.isArray(promise) ? promise : [promise], false);
  }
  safeRace<T>(promise: Promise<T>, defaultValue?: T): Promise<T> {
    return this._race([promise], true, defaultValue);
  }
  private async _race<T>(
    promises: Promise<T>[],
    safe: boolean,
    defaultValue?: T
  ): Promise<T> {
    const terminatePromise = new ManualPromise<Error>();
    const frames = captureRawStack();
    if (this._terminateError) {
      terminatePromise.resolve(this._terminateError);
    }
    if (this._closeError) {
      terminatePromise.resolve(cloneError(this._closeError, frames));
    }
    this._terminatePromises.set(terminatePromise, frames);
    try {
      return await Promise.race([
        terminatePromise.then((e) =>
          safe ? (defaultValue as T) : Promise.reject(e)
        ),
        ...promises,
      ]);
    } finally {
      this._terminatePromises.delete(terminatePromise);
    }
  }
}
function cloneError(error: Error, frames: string[]) {
  const clone = new Error(error.message);
  clone.name = error.name;
  clone.stack = [`${error.name}:${error.message}`, ...frames].join('\n');
  return clone;
}
function captureRawStack(): string[] {
  const stackTraceLimit = Error.stackTraceLimit;
  Error.stackTraceLimit = 50;
  const error = new Error('Stack trace capture');
  const stack = error.stack ?? '';
  Error.stackTraceLimit = stackTraceLimit;
  return stack.split('\n');
}
