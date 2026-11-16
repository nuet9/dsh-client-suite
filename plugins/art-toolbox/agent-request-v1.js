// Private in-process marker: JSON/UI payloads cannot request inline delivery.
export const inlineTask = Symbol('art-toolbox-inline-task');
export function assertActiveTask(job){if(!job||!['submitting','submitted','working'].includes(job.status))throw Error('Task is terminal or unavailable; do not replay Pinterest operations. Use continue with a new requestId for an explicitly requested new round.');}
// UI calls keep previews; model calls retrieve images explicitly by file path.
export function agentRequest(a,sessionId,sessionTarget){const {sessionTarget:_untrusted,...request}=a;return {...request,sessionId,...(sessionTarget?{sessionTarget}:{}),[inlineTask]:true,includePreviews:false,includeThumbnails:false};}
