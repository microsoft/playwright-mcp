/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { Context } from '../context';
import { Disposable } from '../utils/events';

export type ResourceSchema = {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
};

export type ResourceResult = {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string;
};

export type Resource = {
  schema: ResourceSchema;
  read: (context: Context, uri: string) => Promise<ResourceResult[]>;
};

export type ResourceList = {
  list: (context: Context) => Promise<Resource[]>;
  subscribe(context: Context, onChanged: () => void): Disposable;
};
