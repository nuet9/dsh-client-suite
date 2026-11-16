import path from 'node:path';
import {lstat} from 'node:fs/promises';

const validId = id => typeof id === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(id) && !/^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i.test(id);
const inside = (root, candidate) => {
  const relative = path.relative(root, candidate);
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
};

export async function resolveWorkflowFolder({target, id, libraryRoot, comfyRoot, stat = lstat, detail} = {}) {
  if (!['library', 'source', 'installed'].includes(target)) throw Object.assign(new Error('无效的工作流文件夹目标'), {code: 'INVALID_TARGET'});
  const library = path.resolve(libraryRoot);
  const comfy = path.resolve(comfyRoot);
  let folder;
  if (target === 'library') {
    folder = library;
  } else if (target === 'source') {
    if (!validId(id)) throw Object.assign(new Error('无效的工作流ID'), {code: 'INVALID_ID'});
    if (typeof detail !== 'function') throw Object.assign(new Error('工作流详情服务不可用'), {code: 'SERVICE_UNAVAILABLE'});
    const value = await detail({action: 'detail', id});
    folder = path.resolve(library, id);
    if (path.resolve(value?.record?.id ? path.join(library, value.record.id) : '') !== folder || !inside(library, folder)) throw Object.assign(new Error('工作流路径不在库目录内'), {code: 'UNSAFE_PATH'});
  } else {
    folder = path.join(comfy, 'user', 'default', 'workflows', '美术工具箱');
  }
  const info = await stat(folder);
  if (!info.isDirectory() || info.isSymbolicLink()) throw Object.assign(new Error('目标工作流文件夹不存在或不是安全目录'), {code: 'UNSAFE_PATH'});
  return folder;
}

export async function verifyWorkflowFolderResolver() {
  const root = path.resolve('C:/test/workflows');
  const comfy = path.resolve('__DSH_SUITE_ART_TOOLBOX_COMFY_ROOT__/ComfyUI');
  const calls = [];
  const fakeStat = async folder => ({isDirectory: () => true, isSymbolicLink: () => false, folder});
  const detail = async args => { calls.push(args); return {record: {id: args.id}}; };
  const library = await resolveWorkflowFolder({target: 'library', libraryRoot: root, comfyRoot: comfy, stat: fakeStat, detail});
  const source = await resolveWorkflowFolder({target: 'source', id: 'safe_id-1', libraryRoot: root, comfyRoot: comfy, stat: fakeStat, detail});
  const installed = await resolveWorkflowFolder({target: 'installed', libraryRoot: root, comfyRoot: comfy, stat: fakeStat, detail});
  const rejects = [];
  for (const input of [{target: 'arbitrary', id: 'safe_id-1'}, {target: 'source', id: '../escape'}]) {
    try { await resolveWorkflowFolder({...input, libraryRoot: root, comfyRoot: comfy, stat: fakeStat, detail}); } catch { rejects.push(true); }
  }
  if (library !== root || source !== path.join(root, 'safe_id-1') || installed !== path.join(comfy, 'user', 'default', 'workflows', '美术工具箱') || calls.length !== 1 || rejects.length !== 2) throw new Error('workflow-folder verification failed');
  return {passed: true, library, source, installed, rejectedInvalidTargetAndTraversal: rejects.length === 2};
}
