import {AnalysisError} from '../ai/errors';
import {readIntakeConfig,type IntakeConfig} from '../intake/service';

export type MaterialConfig=IntakeConfig;
export const MATERIAL_MODEL_TIMEOUT_MS=120_000;

/** Keep the configured intake model/key, but not the short manual-intake deadline. */
export function readMaterialConfig(env:Readonly<Record<string,string|undefined>>=process.env):MaterialConfig{
  const config=readIntakeConfig({...env,AI_INTAKE_TIMEOUT_MS:undefined});
  const timeoutMs=Number(env.AI_MATERIAL_TIMEOUT_MS||MATERIAL_MODEL_TIMEOUT_MS);
  if(!Number.isInteger(timeoutMs)||timeoutMs<1000||timeoutMs>MATERIAL_MODEL_TIMEOUT_MS)throw new AnalysisError('CONFIGURATION_ERROR','材料整理配置无效：请管理员检查 1000–120000 毫秒的 AI 材料整理时限。',503);
  return {...config,timeoutMs};
}
