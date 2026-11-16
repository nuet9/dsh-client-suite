// Installed DSH storage contract: /^[a-z][a-z0-9_]*$/ (units and tables).
export const CACHE_NAME='drock_request_stats_cache';
export function createCacheSpec(z,viewSchema) {
  return {name:CACHE_NAME,version:1,layout:'per-record',invalidRecords:'backup-and-skip',tables:{
    snapshots:{valueSchema:z.object({stats:viewSchema,title:z.string(),at:z.number().int()})},
    failures:{valueSchema:z.object({title:z.string(),message:z.string(),status:z.number().int().nullable(),at:z.number().int()})}
  }};
}
