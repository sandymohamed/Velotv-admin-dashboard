import React,{useEffect,useRef,useState} from 'react';
import {money,timestamp} from './commerce';
const base='/api/admin/console/';
function Dialog({title,busy,close,children}){const ref=useRef(null);useEffect(()=>{const node=ref.current;node.showModal();return()=>node.close();},[]);return <dialog className="panel modal detail-modal" ref={ref} aria-label={title} onCancel={e=>{e.preventDefault();if(!busy)close();}}><div className="section-head"><h2>{title}</h2><button className="secondary" disabled={busy} onClick={close}>Close</button></div>{children}</dialog>;}
function EditAgent({row,plans,api,close,done}){
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  async function submit(event){event.preventDefault();if(busy)return;const data=new FormData(event.currentTarget),body=Object.fromEntries(data);body.enabled=data.has('enabled');body.default_plan_id=Number(body.default_plan_id);if(!body.password)delete body.password;setBusy(true);setError('');
    try{await api(base+'agents'+(row?'/'+row.id:''),{method:row?'PATCH':'POST',body});done('Agent saved.');}catch(err){setError(err.message);}finally{setBusy(false);}}
  return <Dialog title={row?'Edit sales agent':'Add sales agent'} busy={busy} close={close}><form className="form dialog-form" onSubmit={submit}><fieldset disabled={busy}>
    <label>Username<input name="username" required minLength="2" maxLength="120" defaultValue={row?.username}/></label><label>Email<input name="email" type="email" required maxLength="255" defaultValue={row?.email}/></label>
    <label>Phone<input name="phone" maxLength="50" defaultValue={row?.phone}/></label><label>{row?'New password (optional)':'Password'}<input name="password" type="password" autoComplete="new-password" required={!row} minLength="10" maxLength="72"/></label>
    <label>Default plan for new resellers<select name="default_plan_id" required defaultValue={row?.default_plan_id||''}><option value="">Choose a plan</option>{plans.filter(p=>Number(p.enabled)).map(p=><option value={p.id} key={p.id}>{p.name} · {p.duration_months} months</option>)}</select></label>
    <label className="check"><input name="enabled" type="checkbox" defaultChecked={!row||row.status===1}/>Agent enabled</label><p className="muted">The agent retains a 10% listed sales margin on their own reseller wallet transfers. Direct top-ups earn no agent margin. Disabling the agent does not suspend their resellers.</p>
    {error&&<p className="notice error" role="alert">{error}</p>}<button className="primary">{busy?'Saving…':'Save agent'}</button>
  </fieldset></form></Dialog>;
}
function Funding({row,api,close,done}){
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const [reference]=useState(()=>crypto.randomUUID());
  async function submit(event){event.preventDefault();if(busy)return;const data=new FormData(event.currentTarget);setBusy(true);setError('');
    try{await api(base+'agents/'+row.id+'/fundings',{body:{amount:data.get('amount'),paymentId:data.get('paymentId')}});done('Paid funds added to agent wallet.');}catch(err){setError(err.message);}finally{setBusy(false);}}
  return <Dialog title={'Add paid funds: '+row.username} busy={busy} close={close}><form className="form dialog-form" onSubmit={submit}><fieldset disabled={busy}>
    <p className="muted">Record the EUR amount actually paid to the platform. For example, €90 funds a €90 agent wallet; transferring €100 of reseller credit later costs the agent €90.</p>
    <label>Paid amount (EUR)<input name="amount" type="number" required min="0.01" max="99999.99" step="0.01"/></label>
    <label>Unique payment reference<input name="paymentId" required maxLength="128" defaultValue={reference}/></label>
    <label className="check"><input type="checkbox" required/>Payment has been received and verified</label>
    {error&&<p className="notice error" role="alert">{error}</p>}<button className="primary">{busy?'Adding…':'Add funds'}</button>
  </fieldset></form></Dialog>;
}
function Report({row,api,close}){
  const [state,setState]=useState({loading:true,error:'',data:null});
  useEffect(()=>{const controller=new AbortController();api(base+'agents/'+row.id+'/report',{signal:controller.signal}).then(data=>{if(!controller.signal.aborted)setState({loading:false,error:'',data});}).catch(err=>{if(!controller.signal.aborted)setState({loading:false,error:err.message,data:null});});return()=>controller.abort();},[api,row.id]);
  return <Dialog title={'Agent report: '+row.username} close={close}>{state.loading?<p role="status">Loading…</p>:state.error?<p className="notice error" role="alert">{state.error}</p>:<div className="dialog-form">
    <p>Balance: <strong>{money(state.data.profile.balance)}</strong> · Sales value: {money(state.data.profile.sales_total)} · Listed margin: {money(state.data.profile.margin_total)}</p>
    <h2>Latest transfers</h2><div className="table-scroll"><table><thead><tr>{['Date','Reseller','Credit','Cost','Margin'].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{state.data.transfers.rows.map(t=><tr key={t.id}><td>{timestamp(t.created_at)}</td><td>#{t.reseller_id}</td><td>{money(t.face_amount)}</td><td>{money(t.cost_amount)}</td><td>{money(t.margin_amount)}</td></tr>)}</tbody></table></div>
    <h2>Latest wallet movements</h2><div className="table-scroll"><table><thead><tr>{['Date','Kind','Change','Balance'].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{state.data.wallet.rows.map(t=><tr key={t.id}><td>{timestamp(t.created_at)}</td><td>{t.kind}</td><td>{money(t.delta)}</td><td>{money(t.new_balance)}</td></tr>)}</tbody></table></div>
    <p className="muted">Showing the latest 100 transfers and wallet entries. Funding is platform cash received; reseller credit transfers are internal allocations.</p>
  </div>}</Dialog>;
}
export default function AgentManager({api,revision}){
  const [state,setState]=useState({loading:true,rows:[],count:0,plans:[],error:''}),[page,setPage]=useState(0),[search,setSearch]=useState(''),[local,refresh]=useState(0),[modal,setModal]=useState(null),[notice,setNotice]=useState('');
  useEffect(()=>{const controller=new AbortController();setState(s=>({...s,loading:true,error:''}));Promise.all([api(base+'agents?'+new URLSearchParams({page,search}),{signal:controller.signal}),api(base+'plans',{signal:controller.signal})]).then(([data,plans])=>{if(!controller.signal.aborted)setState({...data,plans:plans.plans,loading:false,error:''});}).catch(err=>{if(!controller.signal.aborted)setState(s=>({...s,loading:false,error:err.message}));});return()=>controller.abort();},[api,revision,page,search,local]);
  const done=message=>{setModal(null);setNotice(message);refresh(x=>x+1);};
  return <section className="panel section"><div className="section-head"><div><h2>Sales agents</h2><p className="muted">Prepaid wallets · 10% margin on the agent's own sales · No playlist access.</p></div><button className="primary" disabled={!state.plans.some(p=>Number(p.enabled))} onClick={()=>setModal({type:'edit'})}>Add agent</button></div>
    <form className="toolbar" onSubmit={e=>{e.preventDefault();setSearch(new FormData(e.currentTarget).get('search'));setPage(0);}}><input name="search" maxLength="120" placeholder="Name, email or phone" aria-label="Search agents"/><button className="secondary">Search</button></form>
    {notice&&<p className="notice success" role="status">{notice}</p>}{state.error&&<p className="notice error" role="alert">{state.error}</p>}
    {state.loading?<p role="status">Loading agents…</p>:<div className="table-scroll"><table><thead><tr>{['Agent','Status','Balance','Resellers','Credit sold','Margin','Manage'].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{state.rows.map(row=><tr key={row.id}><td><strong>{row.username}</strong><small>{row.email}</small></td><td>{row.status===1?'Enabled':'Disabled'}</td><td>{money(row.balance)}</td><td>{row.reseller_count}</td><td>{money(row.sales_total)}</td><td>{money(row.margin_total)}</td><td><div className="row-actions"><button className="text-button" onClick={()=>setModal({type:'edit',row})}>Edit</button><button className="text-button" onClick={()=>setModal({type:'fund',row})}>Add paid funds</button><button className="text-button" onClick={()=>setModal({type:'report',row})}>Report</button></div></td></tr>)}</tbody></table>{!state.rows.length&&<p className="table-message">No agents found.</p>}</div>}
    <div className="pagination"><span>{state.count} agents · Page {page+1}</span><button className="secondary" disabled={!page||state.loading} onClick={()=>setPage(page-1)}>Previous</button><button className="secondary" disabled={state.loading||(page+1)*50>=state.count} onClick={()=>setPage(page+1)}>Next</button></div>
    {modal?.type==='edit'&&<EditAgent row={modal.row} plans={state.plans} api={api} close={()=>setModal(null)} done={done}/>}{modal?.type==='fund'&&<Funding row={modal.row} api={api} close={()=>setModal(null)} done={done}/>}{modal?.type==='report'&&<Report row={modal.row} api={api} close={()=>setModal(null)}/>}
  </section>;
}

export function AdminInvitation({row,api,close}){
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[link,setLink]=useState(''),[message,setMessage]=useState('');
  async function issue(manual){setBusy(true);setError('');setLink('');setMessage('');try{const result=await api(base+'resellers/'+row.id+'/invitation',{body:{manual}});if(result.setup_url)setLink(result.setup_url);else setMessage(result.delivery==='sent'?'Private setup invitation emailed.':'Email delivery unavailable. Configure SMTP or create a manual link.');}catch(err){setError(err.message);}finally{setBusy(false);}}
  return <Dialog title={'Private invitation: '+row.username} busy={busy} close={close}><div className="form dialog-form"><p className="muted">Send this link only to the reseller's verified contact. Never share it with the sales agent. Issuing a new invitation revokes the previous link.</p>
    <div className="actions"><button className="primary" disabled={busy} onClick={()=>issue(false)}>Send email</button><button className="secondary" disabled={busy} onClick={()=>issue(true)}>Create manual setup link</button></div>
    {link&&<label>Private reseller setup URL<input readOnly value={link} onFocus={e=>e.target.select()}/></label>}{message&&<p role="status">{message}</p>}{error&&<p className="notice error" role="alert">{error}</p>}
  </div></Dialog>;
}
