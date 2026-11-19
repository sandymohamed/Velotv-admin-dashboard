import React, { useEffect, useRef, useState } from 'react';
import { money, offerState, parseDate, timestamp } from './commerce';

const base='/api/admin/console/';
function localInput(value) {
  const date=parseDate(value);
  if (!date) return '';
  const local=new Date(date.valueOf()-date.getTimezoneOffset()*60000);
  return local.toISOString().slice(0,19);
}
function initialValues(row) {
  const start=new Date(); const end=new Date();end.setMonth(end.getMonth()+3);
  return { name:row?.name || '',packageId:String(row?.package_id || ''),enabled:row ? Boolean(Number(row.enabled)) : true,
    start:localInput(row?.starts_at || start.toISOString()),end:localInput(row?.ends_at || end.toISOString()),
    amount:row?.offer_amount || '',limit:row?.max_purchases_per_reseller ?? '',
    audience:row?.audience || 'all',selected:row?.reseller_ids || [] };
}

function OfferEditor({ row, packages, api, close, saved }) {
  const [form,setForm]=useState(()=>initialValues(row));
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [search,setSearch]=useState('');
  const [page,setPage]=useState(0);
  const [resellers,setResellers]=useState({ rows:[],count:0,error:'',loading:false });
  const ref=useRef(null);
  useEffect(()=>{const node=ref.current;node.showModal();return()=>node.close();},[]);
  useEffect(()=>{
    if(form.audience!=='selected')return;
    const controller=new AbortController();
    const timer=setTimeout(()=>{
      setResellers({ rows:[],count:0,error:'',loading:true });
      api(base+'resellers?'+new URLSearchParams({ search,page }),{signal:controller.signal}).then(data=>{
        if(!controller.signal.aborted)setResellers({ ...data,error:'',loading:false });
      }).catch(err=>{if(!controller.signal.aborted)setResellers({ rows:[],count:0,error:err.message,loading:false });});
    },250);
    return()=>{clearTimeout(timer);controller.abort();};
  },[api,form.audience,search,page]);
  const update=(key,value)=>setForm(current=>({...current,[key]:value}));
  const chosen=packages.find(pack=>Number(pack.id)===Number(form.packageId));
  async function submit(event) {
    event.preventDefault();if(busy)return;
    setError('');
    const start=new Date(form.start),end=new Date(form.end);
    if(!chosen || !Number.isFinite(start.valueOf()) || !Number.isFinite(end.valueOf()) || end<=start){setError('Choose a package and an end time after the start.');return;}
    if(Number(form.amount)>Number(chosen.package_amount)){setError('Offer price cannot exceed the base package price.');return;}
    if(form.audience==='selected'&&!form.selected.length){setError('Select at least one reseller.');return;}
    const body={name:form.name.trim(),enabled:form.enabled,starts_at:start.toISOString(),ends_at:end.toISOString(),
      offer_amount:Number(form.amount),max_purchases_per_reseller:form.limit===''?null:Number(form.limit),
      audience:form.audience,reseller_ids:form.audience==='selected'?form.selected:[]};
    setBusy(true);
    try{
      await api(base+(row?'package-offers/'+row.id:'coupon-packages/'+chosen.id+'/offers'),{method:row?'PATCH':'POST',body});
      saved();
    }catch(err){setError(err.message);}finally{setBusy(false);}
  }
  return <dialog ref={ref} className="panel modal offer-editor" aria-labelledby="offer-title" onCancel={event=>{event.preventDefault();if(!busy)close();}}>
    <div className="section-head"><h2 id="offer-title">{row?'Edit offer':'Create offer'}</h2><button className="secondary" disabled={busy} onClick={close}>Close</button></div>
    <form className="form dialog-form offer-form" onSubmit={submit}><fieldset disabled={busy}>
      <label>Package<select required disabled={Boolean(row)} value={form.packageId} onChange={e=>update('packageId',e.target.value)}>
        <option value="">Choose package</option>{packages.map(pack=><option key={pack.id} value={pack.id}>{pack.package_name} · {money(pack.package_amount)}{!Number(pack.enabled)?' · disabled':''}</option>)}</select></label>
      {chosen&&<p className="muted">{chosen.count_devices} activations · {chosen.periods} months per device · Base price {money(chosen.package_amount)}{Number(chosen.offer_only)?' · Available only with an eligible offer':''}</p>}
      <label>Offer name<input required maxLength="120" value={form.name} onChange={e=>update('name',e.target.value)}/></label>
      <div className="form-row"><label>Offer price (EUR)<input required type="number" min="0.01" max={chosen?Number(chosen.package_amount):99999.99} step="0.01" value={form.amount} onChange={e=>update('amount',e.target.value)}/></label>
        <label>Purchases per reseller<input type="number" min="1" max="100000" step="1" placeholder="No limit" value={form.limit} onChange={e=>update('limit',e.target.value)}/></label></div>
      <div className="form-row"><label>Starts<input required type="datetime-local" step="1" value={form.start} onChange={e=>update('start',e.target.value)}/></label>
        <label>Ends<input required type="datetime-local" step="1" value={form.end} onChange={e=>update('end',e.target.value)}/></label></div>
      <p className="muted">Enter times in your browser timezone ({Intl.DateTimeFormat().resolvedOptions().timeZone}). They are saved as UTC. End time stops new purchases; purchased codes retain their duration.</p>
      <label className="check"><input type="checkbox" checked={form.enabled} onChange={e=>update('enabled',e.target.checked)}/>Offer enabled</label>
      <label>Eligible resellers<select value={form.audience} onChange={e=>update('audience',e.target.value)}><option value="all">All resellers</option><option value="selected">Selected resellers</option></select></label>
      {form.audience==='selected'&&<div className="offer-scope">
        <label>Find reseller<input maxLength="120" value={search} placeholder="Name, email or phone" onChange={e=>{setSearch(e.target.value);setPage(0);}}/></label>
        <div className="selected-resellers" aria-label="Selected resellers">{form.selected.map(id=><button type="button" key={id} onClick={()=>update('selected',form.selected.filter(value=>value!==id))}>#{id} ×</button>)}</div>
        <p className="muted">{form.selected.length} selected / 500. Selections are kept while searching and paging.</p>
        {resellers.loading?<p role="status">Loading…</p>:resellers.error?<p role="alert" className="notice error">{resellers.error}</p>:<div className="reseller-options">{resellers.rows.map(item=><label key={item.id}>
          <input type="checkbox" checked={form.selected.includes(item.id)} disabled={form.selected.length>=500&&!form.selected.includes(item.id)} onChange={e=>update('selected',e.target.checked?[...form.selected,item.id]:form.selected.filter(id=>id!==item.id))}/>
          <span>#{item.id} · {item.username} · {item.email} · {item.state}</span></label>)}{!resellers.rows.length&&<p>No resellers found.</p>}</div>}
        <div className="pagination"><button type="button" className="secondary" disabled={!page||resellers.loading} onClick={()=>setPage(page-1)}>Previous</button><span>Page {page+1}</span>
          <button type="button" className="secondary" disabled={resellers.loading||(page+1)*50>=resellers.count} onClick={()=>setPage(page+1)}>Next</button></div>
      </div>}
      {error&&<p className="notice error" role="alert">{error}</p>}
      <p className="muted">Editing this offer keeps its purchase counter. Create a new offer for a new campaign. Pending PayPal checkouts count toward the limit.</p>
      <button className="primary">{busy?'Saving…':'Save offer'}</button>
    </fieldset></form>
  </dialog>;
}

export default function OfferManager({ api, revision }) {
  const [state,setState]=useState({ loading:true,offers:[],packages:[],error:'' });
  const [edit,setEdit]=useState(null);
  const [localRevision,refresh]=useState(0);
  const [filter,setFilter]=useState('');
  const [busy,setBusy]=useState(null);
  const [notice,setNotice]=useState('');
  const [actionError,setActionError]=useState('');
  const [now,setNow]=useState(Date.now());
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(timer);},[]);
  useEffect(()=>{
    const controller=new AbortController();setState({loading:true,offers:[],packages:[],error:''});
    Promise.all([api(base+'package-offers'+(filter?'?package_id='+filter:''),{signal:controller.signal}),api(base+'coupon-packages',{signal:controller.signal})])
      .then(([offers,packs])=>{if(!controller.signal.aborted)setState({loading:false,offers:offers.offers,packages:packs.packages,error:''});})
      .catch(err=>{if(!controller.signal.aborted)setState({loading:false,offers:[],packages:[],error:err.message});});
    return()=>controller.abort();
  },[api,revision,localRevision,filter]);
  async function toggle(row) {
    if(busy!==null)return;setBusy(row.id);setActionError('');setNotice('');
    try{
      await api(base+'package-offers/'+row.id,{method:'PATCH',body:{name:row.name,enabled:!Number(row.enabled),starts_at:parseDate(row.starts_at).toISOString(),ends_at:parseDate(row.ends_at).toISOString(),
        offer_amount:Number(row.offer_amount),max_purchases_per_reseller:row.max_purchases_per_reseller,audience:row.audience,reseller_ids:row.reseller_ids}});
      setNotice('Offer updated. Existing purchases keep their original terms.');refresh(value=>value+1);
    }catch(err){setActionError(err.message);}finally{setBusy(null);}
  }
  return <section className="panel section">
    <div className="offer-heading"><div><h2>Scheduled package offers</h2><p className="muted">Discounts, eligibility and purchase limits across wallet and PayPal.</p></div>
      <button className="primary" disabled={state.loading||!state.packages.length} onClick={()=>setEdit({})}>Create offer</button></div>
    <div className="toolbar"><label>Package<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="">All packages</option>{state.packages.map(pack=><option key={pack.id} value={pack.id}>{pack.package_name}</option>)}</select></label></div>
    {notice&&<p className="notice success" role="status">{notice}</p>}{actionError&&<p className="notice error" role="alert">{actionError}</p>}
    {state.loading?<p role="status" className="table-message">Loading offers…</p>:state.error?<p role="alert" className="notice error">{state.error}</p>:!state.offers.length?<p className="table-message">No offers yet. Create a package first, then add an offer.</p>:
      <div className="table-scroll" role="region" tabIndex="0" aria-label="Scheduled package offers"><table><thead><tr>{['Offer','Package','Status','Offer price','Schedule (UTC)','Limit / reseller','Audience','Manage'].map(title=><th key={title}>{title}</th>)}</tr></thead>
        <tbody>{state.offers.map(row=>{
          const pack=state.packages.find(item=>item.id===row.package_id);const status=row.package_archived_at?'archived':offerState(row,pack,now);
          return <tr key={row.id}><td><strong>{row.name}</strong><small>#{row.id}</small></td><td>{row.package_name}<small>Base {money(pack?.package_amount ?? row.base_amount)}</small></td>
            <td><span className={'state state-'+status.replaceAll(' ','-')}>{status}</span></td><td>{money(row.offer_amount)}</td><td>{timestamp(row.starts_at)}<small>Until {timestamp(row.ends_at)}</small></td>
            <td>{row.max_purchases_per_reseller??'No limit'}</td><td>{row.audience==='all'?'All resellers':row.reseller_ids.map(id=>'#'+id).join(', ')}</td>
            <td><div className="row-actions"><button className="text-button" disabled={busy!==null||Boolean(row.package_archived_at)} onClick={()=>setEdit(row)}>Edit</button><button className="text-button" disabled={busy!==null||Boolean(row.package_archived_at)} onClick={()=>toggle(row)}>{Number(row.enabled)?'Disable':'Enable'}</button></div></td></tr>;
        })}</tbody></table></div>}
    <p className="table-message">Showing up to 500 offers. Filter by package to narrow the list. An enabled offer is available only during its schedule and while its package is enabled.</p>
    {edit&&<OfferEditor row={edit.id?edit:null} packages={state.packages} api={api} close={()=>setEdit(null)} saved={()=>{setEdit(null);setNotice('Offer saved.');refresh(value=>value+1);}}/>}
  </section>;
}
