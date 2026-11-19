import React, { useEffect, useRef, useState } from 'react';

const base='/api/admin/console/coupon-packages/';

function RemovalDialog({ row, api, close, done }) {
  const ref=useRef(null);
  const [preview,setPreview]=useState(null);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  useEffect(()=>{const node=ref.current;node.showModal();return()=>node.close();},[]);
  useEffect(()=>{
    const controller=new AbortController();
    api(base+row.id+'/deletion-preview',{signal:controller.signal}).then(data=>{
      if(!controller.signal.aborted)setPreview(data);
    }).catch(err=>{if(!controller.signal.aborted)setError(err.message);});
    return()=>controller.abort();
  },[api,row.id]);
  async function confirm(){
    if(busy||!preview)return;
    setBusy(true);setError('');
    try {
      const result=await api(base+row.id,{method:'DELETE'});
      done(result);close();
    }catch(err){setError(err.message);}finally{setBusy(false);}
  }
  return <dialog ref={ref} className="panel modal" aria-labelledby="package-removal-title" onCancel={event=>{event.preventDefault();if(!busy)close();}}>
    <div className="section-head"><h2 id="package-removal-title">Delete package</h2><button className="secondary" disabled={busy} onClick={close}>Close</button></div>
    <div className="form dialog-form">
      <p><strong>{row.package_name}</strong> · #{row.id}</p>
      {!preview&&!error&&<p role="status">Checking purchase and payment history…</p>}
      {preview&&<>
        <p className="notice">{preview.reason}</p>
        {preview.action==='deleted'&&<p className="muted">Permanent deletion cannot be undone. If a purchase arrives before confirmation, the server will archive the package instead.</p>}
        <p className="muted">Existing activation codes, active devices, payment records and saved purchase terms will not be changed.</p>
      </>}
      {error&&<p className="notice error" role="alert">{error}</p>}
      <div className="actions end"><button className="secondary" disabled={busy} onClick={close}>Cancel</button>
        <button className="secondary danger" disabled={!preview||busy} onClick={confirm}>{busy?'Applying…':preview?.action==='archived'?'Archive package':'Permanently delete'}</button></div>
    </div>
  </dialog>;
}

export default function PackageLifecycleActions({ row, api, onChange }) {
  const [open,setOpen]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  async function restore(){
    if(busy)return;setBusy(true);setError('');
    try {const result=await api(base+row.id+'/restore',{method:'POST'});onChange(result);}
    catch(err){setError(err.message);}finally{setBusy(false);}
  }
  return <>
    {row.archived_at?<button className="text-button" disabled={busy} onClick={restore}>{busy?'Restoring…':'Restore'}</button>:
      <button className="text-button danger" onClick={()=>setOpen(true)}>Delete</button>}
    {error&&<span role="alert" className="error-text">{error}</span>}
    {open&&<RemovalDialog row={row} api={api} close={()=>setOpen(false)} done={onChange}/>}
  </>;
}
