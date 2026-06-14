import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { build } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');

const KEY_MODULES = [
  { file: 'database.js', desc: '数据库核心', exports: ['TABLES', 'initializeDatabase', 'exportFullDatabase', 'importFullDatabase', 'parseBackupFile'] },
  { file: 'mergeUtils.js', desc: '合并决策管线', exports: ['DIFF_TYPES', 'DECISION_CHOICES', 'computeFullDiff', 'createDefaultDecisions', 'applyMerge'] },
  { file: 'dataIndex.js', desc: '多维索引引擎', exports: ['DataIndex', 'globalIndex'] },
  { file: 'constants.js', desc: '常量定义', exports: [] },
  { file: 'actorMatchUtils.js', desc: '演员匹配工具', exports: [] },
  { file: 'scheduleStore.js', desc: '排期状态', exports: [] },
  { file: 'workOrderStore.js', desc: '工单状态', exports: [] },
  { file: 'reservationStore.js', desc: '预约状态', exports: [] },
  { file: 'recordsStore.js', desc: '记录状态', exports: [] },
  { file: 'inventoryStore.js', desc: '盘点状态', exports: [] },
  { file: 'sampleDataGenerator.js', desc: '样本数据', exports: [] }
];

describe('关键页面与模块构建冒烟验证', () => {
  describe('模块语法与导出检查', () => {
    for (const m of KEY_MODULES) {
      it(`[构建链路: 模块] ${m.desc} (${m.file}) 可被 import 并导出关键符号`, async () => {
        const mod = await import(path.join(projectRoot, 'src', 'lib', m.file));
        expect(mod).toBeDefined();
        for (const key of m.exports) {
          expect(mod[key], `缺少导出 ${key}`).toBeDefined();
        }
      });
    }
  });

  describe('夹具模块可加载性', () => {
    it('[构建链路: 夹具] migrationSnapshots 可加载且makeV1DB~makeV9DB存在', async () => {
      const mod = await import('./fixtures/migrationSnapshots.js');
      for (let v = 1; v <= 9; v++) {
        const fn = `makeV${v}DB`;
        expect(typeof mod[fn]).toBe('function');
      }
    });

    it('[构建链路: 夹具] backupFixtures 可加载且核心导出完整', async () => {
      const mod = await import('./fixtures/backupFixtures.js');
      expect(typeof mod.makeValidBackupJSON).toBe('function');
      expect(typeof mod.makeCostumeForBackup).toBe('function');
      expect(typeof mod.makeScheduleForBackup).toBe('function');
      expect(typeof mod.backupForIndexTest).toBe('function');
    });

    it('[构建链路: 夹具] mergeData 可加载', async () => {
      const mod = await import('./fixtures/mergeData.js');
      expect(mod).toBeDefined();
    });
  });

  describe('Vite 生产构建', () => {
    it('[构建链路: vite build] 完整 Vite 构建应成功 (退出码 0)', { timeout: 180000 }, async () => {
      let result;
      try {
        result = await build({
          configFile: path.join(projectRoot, 'vite.config.js'),
          root: projectRoot,
          logLevel: 'warn'
        });
      } catch (err) {
        console.error('[构建失败详细错误]:', err.message);
        throw err;
      }
      expect(result, 'vite build 返回结果不应为 null').not.toBeNull();
    });

    it('[构建链路: 构建产物] .svelte-kit 输出目录应存在且含 manifest 或构建结果非空', { timeout: 180000 }, async () => {
      const { existsSync, readdirSync } = await import('fs');
      const svelteKitDir = path.join(projectRoot, '.svelte-kit');
      expect(existsSync(svelteKitDir), '.svelte-kit 构建目录应存在').toBe(true);
      const files = readdirSync(svelteKitDir);
      expect(files.length, '.svelte-kit 应有内容').toBeGreaterThan(0);
    });
  });

  describe('项目 npm 脚本完整性', () => {
    it('[构建链路: npm scripts] package.json 中 verify / test:migration 等脚本存在', () => {
      const pkg = JSON.parse(
        fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8')
      );
      const required = [
        'test', 'test:watch', 'build', 'verify',
        'test:migration', 'test:backup', 'test:merge', 'test:index', 'test:build'
      ];
      for (const name of required) {
        expect(pkg.scripts?.[name], `缺少脚本: ${name}`).toBeDefined();
      }
    });
  });
});
