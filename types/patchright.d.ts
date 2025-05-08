/**
 * Type declarations to fix compatibility between patchright and playwright
 */

// This approach uses declaration merging to augment the types
declare module 'patchright' {
  export * from 'playwright';
}

// Add special handling for the extended evaluate methods that Patchright provides
declare namespace Playwright {
  interface Page {
    evaluate<T>(pageFunction: Function | string, arg?: any, isolatedContext?: boolean): Promise<T>;
    evaluateHandle<T extends Node = Node>(pageFunction: Function | string, arg?: any, isolatedContext?: boolean): Promise<T>;
  }

  interface Frame {
    evaluate<T>(pageFunction: Function | string, arg?: any, isolatedContext?: boolean): Promise<T>;
    evaluateHandle<T extends Node = Node>(pageFunction: Function | string, arg?: any, isolatedContext?: boolean): Promise<T>;
  }

  interface ElementHandle {
    evaluate<T>(pageFunction: Function | string, arg?: any, isolatedContext?: boolean): Promise<T>;
    evaluateHandle<T extends Node = Node>(pageFunction: Function | string, arg?: any, isolatedContext?: boolean): Promise<T>;
  }

  interface JSHandle {
    evaluate<T>(pageFunction: Function | string, arg?: any, isolatedContext?: boolean): Promise<T>;
    evaluateHandle<T extends Node = Node>(pageFunction: Function | string, arg?: any, isolatedContext?: boolean): Promise<T>;
  }
}