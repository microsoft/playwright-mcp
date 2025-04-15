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

export type Action = ClickAction | FillAction | SelectAction;

export interface ClickAction {
  type: 'click';
  button: 'left' | 'middle' | 'right';
}

export interface FillAction {
  type: 'fill';
  text: string;
}

export interface SelectAction {
  type: 'select';
  text: string;
}

export function source() {
  class Recorder {
    constructor(
      private readonly generateLocator: (element: EventTarget) => Promise<string>,
      private readonly record: (log: string) => void
    ) {}

    private async _onClick(event: MouseEvent) {
      if (!event.isTrusted)
        return;
      if (!event.target)
        return;
      this.record(`await page.${await this.generateLocator(event.target)}.click();`);
    }

    private async _onContextMenu(event: MouseEvent) {
      if (!event.isTrusted)
        return;
      if (!event.target)
        return;
      this.record(`await page.${await this.generateLocator(event.target)}.click({ button: 'right' });`);
    }

    private async _onInput(event: Event) {
      if (!event.isTrusted)
        return;
      if (!event.target)
        return;
      const value = (event.target as HTMLInputElement).value;
      this.record(`await page.${await this.generateLocator(event.target)}.fill(${JSON.stringify(value)});`);
    }

    private async _onKeyDown(event: KeyboardEvent) {
      if (!event.isTrusted)
        return;
    }

    private _onKeyUp(event: KeyboardEvent) {
      if (!event.isTrusted)
        return;
    }

    private _onFocus(event: FocusEvent) {
      if (!event.isTrusted)
        return;
    }

    private async _onSelectionChange(event: Event) {
      if (!event.isTrusted)
        return;
      const selection = document.getSelection();
      if (!selection || selection.isCollapsed || !selection.anchorNode)
        return;
      this.record(`await expect(page.${await this.generateLocator(selection.anchorNode)}).toHaveText(${JSON.stringify(selection.toString())});`);
    }

    install() {
      document.addEventListener('click', this._onClick.bind(this));
      document.addEventListener('auxclick', this._onClick.bind(this));
      document.addEventListener('contextmenu', this._onContextMenu.bind(this));
      document.addEventListener('input', this._onInput.bind(this));
      document.addEventListener('keydown', this._onKeyDown.bind(this));
      document.addEventListener('keyup', this._onKeyUp.bind(this));
      document.addEventListener('focus', this._onFocus.bind(this));
      document.addEventListener('selectionchange', this._onSelectionChange.bind(this));
    }
  }

  return { Recorder };
}
