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

import * as playwright from 'playwright';
import yaml from 'yaml';

type PageOrFrameLocator = playwright.Page | playwright.FrameLocator;

export class PageSnapshot {
  private _frameLocators: PageOrFrameLocator[] = [];
  private _text!: string;

  constructor() {
  }

  static async create(page: playwright.Page): Promise<PageSnapshot> {
    const snapshot = new PageSnapshot();
    await snapshot._build(page);
    return snapshot;
  }

  text(): string {
    return this._text;
  }

  private async _build(page: playwright.Page) {
    const yamlDocument = await this._snapshotFrame(page);
    this._text = [
      `- Page Snapshot`,
      '```yaml',
      yamlDocument.toString({ indentSeq: false }).trim(),
      '```',
    ].join('\n');
  }

  private async _snapshotFrame(frame: playwright.Page | playwright.FrameLocator) {
    const frameIndex = this._frameLocators.push(frame) - 1;
    const snapshotString = await frame.locator('body').ariaSnapshot({ ref: true, emitGeneric: true });
    const snapshot = yaml.parseDocument(snapshotString);

    const visit = async (node: any): Promise<unknown> => {
      if (yaml.isPair(node)) {
        await Promise.all([
          visit(node.key).then(k => node.key = k),
          visit(node.value).then(v => node.value = v)
        ]);
      } else if (yaml.isSeq(node) || yaml.isMap(node)) {
        node.items = await Promise.all(node.items.map(visit));
      } else if (yaml.isScalar(node)) {
        if (typeof node.value === 'string') {
          const value = node.value;
          if (frameIndex > 0)
            node.value = value.replace('[ref=', `[ref=f${frameIndex}`);
          if (value.startsWith('iframe ')) {
            const ref = value.match(/\[ref=(.*)\]/)?.[1];
            if (ref) {
              try {
                const childSnapshot = await this._snapshotFrame(frame.frameLocator(`aria-ref=${ref}`));
                return snapshot.createPair(node.value, childSnapshot);
              } catch (error) {
                return snapshot.createPair(node.value, '<could not take iframe snapshot>');
              }
            }
          }
        }
      }

      return node;
    };
    await visit(snapshot.contents);
    return snapshot;
  }

  refLocator(ref: string): playwright.Locator {
    let frame = this._frameLocators[0];
    const match = ref.match(/^f(\d+)(.*)/);
    if (match) {
      const frameIndex = parseInt(match[1], 10);
      frame = this._frameLocators[frameIndex];
      ref = match[2];
    }

    if (!frame)
      throw new Error(`Frame does not exist. Provide ref from the most current snapshot.`);

    return frame.locator(`aria-ref=${ref}`);
  }
}
