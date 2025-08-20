// Copyright (c) Microsoft Corporation.
// Licensed under the Apache License, Version 2.0.
// ESM script: parse a snapshot (YAML-like accessibility tree) into JSON fields

import fs from 'node:fs';
import path from 'node:path';

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf-8');
}

function writeText(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text);
}

function getVietnameseTestValue(fieldLabelLower) {
  const data = {
    'họ tên': 'Nguyễn Văn An',
    'tên': 'Nguyễn Văn An',
    'cmt': '001234567890',
    'cccd': '001234567890',
    'nơi cấp': 'Công an Thành phố Hà Nội',
    'ngày sinh': '15/06/1990',
    'ngày cấp': '01/01/2020',
    'số điện thoại': '0912345678',
    'điện thoại': '0912345678',
    'email': 'nguyenvanan@email.com',
    'địa chỉ': '123 Phố Huế, Phường Điện Biên, Hà Nội',
    'công ty': 'Công ty TNHH ABC',
    'mã số thuế': '0123456789',
    'khoảng cách': '5',
    'biển số': '30A-12345',
    'số máy': 'ENG123456',
    'số khung': 'FRAME123456789',
    'nơi đăng ký': 'Phòng CSGT Hà Nội',
    'màu sắc': 'Đen',
    'số tài khoản': '1234567890123456',
    'link google drive': 'https://drive.google.com/folder/sample',
    'vị trí công việc': 'Nhân viên',
    'tên chủ xe': 'Nguyễn Văn An',
    'địa chỉ chủ xe': '123 Phố Huế, Hà Nội',
    'số đăng ký xe': 'VN001',
    'chủ tài khoản': 'Nguyễn Văn An',
  };

  if (fieldLabelLower.includes('họ tên') || fieldLabelLower === 'tên chủ xe') return data['họ tên'];
  if (fieldLabelLower.includes('cmt') || fieldLabelLower.includes('cccd')) return data['cccd'];
  if (fieldLabelLower.includes('nơi cấp')) return data['nơi cấp'];
  if (fieldLabelLower.includes('số điện thoại') || fieldLabelLower.includes('điện thoại')) return data['số điện thoại'];
  if (fieldLabelLower.includes('email')) return data['email'];
  if (fieldLabelLower.includes('địa chỉ') && fieldLabelLower.includes('chủ xe')) return data['địa chỉ chủ xe'];
  if (fieldLabelLower.includes('địa chỉ') || fieldLabelLower.includes('nhập địa chỉ')) return data['địa chỉ'];
  if (fieldLabelLower.includes('công ty') || fieldLabelLower.includes('nơi làm việc')) return data['công ty'];
  if (fieldLabelLower.includes('mã số thuế')) return data['mã số thuế'];
  if (fieldLabelLower.includes('khoảng cách')) return data['khoảng cách'];
  if (fieldLabelLower.includes('biển số')) return data['biển số'];
  if (fieldLabelLower.includes('số máy')) return data['số máy'];
  if (fieldLabelLower.includes('số khung')) return data['số khung'];
  if (fieldLabelLower.includes('số đăng ký')) return data['số đăng ký xe'];
  if (fieldLabelLower.includes('nơi đăng ký')) return data['nơi đăng ký'];
  if (fieldLabelLower.includes('màu sắc')) return data['màu sắc'];
  if (fieldLabelLower.includes('số tài khoản')) return data['số tài khoản'];
  if (fieldLabelLower.includes('chủ tài khoản')) return data['chủ tài khoản'];
  if (fieldLabelLower.includes('link google drive')) return data['link google drive'];
  if (fieldLabelLower.includes('vị trí công việc')) return data['vị trí công việc'];
  if (fieldLabelLower.includes('ghi chú')) return 'Đây là ghi chú test';
  if (fieldLabelLower.includes('ngày') && (fieldLabelLower.includes('sinh') || fieldLabelLower.includes('cấp') || fieldLabelLower.includes('đăng ký') || fieldLabelLower.includes('giải ngân'))) return data['ngày sinh'];
  return 'test value';
}

function parseSnapshotToFields(text) {
  const lines = text.split('\n');
  const fields = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();

    // Only consider fillable element roles
    const isTextInput = line.includes('textbox') && line.includes('[ref=');
    const isNumberInput = line.includes('spinbutton') && line.includes('[ref=');
    const isCombo = line.includes('combobox') && line.includes('[ref=');
    const isDisabled = line.includes('[disabled]');
    if (!(isTextInput || isNumberInput || isCombo) || isDisabled)
      continue;

    const refMatch = line.match(/\[ref=([^\]]+)\]/);
    if (!refMatch) continue;
    const ref = refMatch[1];

    let role = isCombo ? 'combobox' : isNumberInput ? 'spinbutton' : 'textbox';
    let element = role;
    let labelLower = '';

    // Try to extract quoted accessible name: textbox "Name" or spinbutton "Label"
    const quoted = line.match(/(textbox|spinbutton|combobox)\s*"([^"]+)"/);
    if (quoted) {
      element = `${quoted[1]} "${quoted[2]}"`;
      labelLower = quoted[2].toLowerCase();
    } else {
      // Look around for generic "Label" ... lines as context
      for (let j = Math.max(0, i - 5); j <= Math.min(lines.length - 1, i + 3); j++) {
        const ctx = lines[j].trim();
        const m = ctx.match(/generic\s*"([^"]+)"\s*\[ref=([^\]]+)\]/);
        if (m && ctx.includes(':')) {
          element = `${role} "${m[1]}"`;
          labelLower = m[1].toLowerCase();
          break;
        }
      }
    }

    if (role === 'combobox') {
      fields.push({
        ref,
        element,
        actions: [
          { type: 'click' },
          { type: 'wait_for_options', timeout: 4000 },
          { type: 'select_first' },
        ],
      });
    } else {
      // textbox / spinbutton
      const value = getVietnameseTestValue(labelLower);
      fields.push({
        ref,
        element,
        actions: [ { type: 'clear_then_fill', value } ],
      });
    }
  }

  return fields;
}

function main() {
  const [,, snapshotPathArg, outPathArg] = process.argv;
  if (!snapshotPathArg || !outPathArg) {
    console.error('Usage: node utils/snapshot-to-fill-json.js <snapshot.yaml> <out.json>');
    process.exit(1);
  }
  const start = Date.now();
  const snapshotPath = path.resolve(snapshotPathArg);
  const outPath = path.resolve(outPathArg);

  const text = readText(snapshotPath);
  const fields = parseSnapshotToFields(text);
  const payload = { fields, timeout: 60000 };
  writeText(outPath, JSON.stringify(payload, null, 2));

  const elapsed = Math.round((Date.now() - start) / 1000);
  const timeFile = outPath.replace(/\.json$/, '.time');
  writeText(timeFile, `${elapsed}s`);
  console.log(`Wrote ${fields.length} fields to ${outPath} in ${elapsed}s`);
}

main();


