// Notification-only compatibility. The caller owns strict plugin/turn attribution.
// This is not evidence that an upstream PI_AI_ERROR was a normal completion.
export function isNotificationEmptyFailure(failure){
  return (failure?.status===undefined||failure.status===200)&&(failure?.code==='EMPTY_RESPONSE'||(failure?.code==='PI_AI_ERROR'&&failure.message==='上游返回 200 但内容为空'));
}

/** Normalize only balanced, exactly empty text/reasoning blocks, never content or tools. */
export async function* silenceNotificationStream(chunks,{allow=false,signal,onSuppressed}={}){
  let eligible=allow===true,pending;
  const open=new Map(),seen=new Set(),buffer=[];
  try{
    for await(const chunk of chunks){
      if(pending!==undefined){for(const held of buffer.splice(0))yield held;yield pending;pending=undefined;eligible=false;}
      if(eligible){
        if(chunk.type==='block-start'){
          if(!Number.isSafeInteger(chunk.index)||chunk.index<0||seen.has(chunk.index)||open.size||!['text','reasoning'].includes(chunk.blockType))eligible=false;
          else {seen.add(chunk.index);open.set(chunk.index,chunk.blockType);}
        }else if(chunk.type==='block-end'){
          const block=chunk.block;
          if(!open.has(chunk.index)||block?.type!==open.get(chunk.index)||block.text!==''||Object.keys(block).some(k=>k!=='type'&&k!=='text'))eligible=false;
          else open.delete(chunk.index);
        }else if(chunk.type!=='usage'&&chunk.type!=='finish')eligible=false;
        // Bound memory for malformed adapters, failing open to normal error handling.
        if(buffer.length>=128)eligible=false;
      }
      if(!eligible){for(const held of buffer.splice(0))yield held;yield chunk;continue;}
      if(chunk.type==='finish'){
        if(!signal?.aborted&&!open.size&&chunk.reason?.kind==='error'&&isNotificationEmptyFailure(chunk.reason.failure))pending=chunk;
        else {for(const held of buffer.splice(0))yield held;yield chunk;eligible=false;}
      }else if(chunk.type==='usage'&&!buffer.length)yield chunk;
      else buffer.push(chunk);
    }
  }catch(error){for(const held of buffer.splice(0))yield held;throw error;}
  if(pending!==undefined){
    if(signal?.aborted){for(const held of buffer)yield held;yield pending;return;}
    // Observe the original failure before publishing the compatible completion.
    if(onSuppressed)await onSuppressed(pending.reason.failure);
    if(signal?.aborted){for(const held of buffer)yield held;yield pending;return;}
    for(const held of buffer)if(held.type==='usage')yield held;
    yield {...pending,reason:{kind:'stop'}};
  }else for(const held of buffer)yield held;
}
