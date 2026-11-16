import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, CreditCard, LayoutDashboard, LogOut, Monitor, Plus, RefreshCw, Ticket, Users } from 'lucide-react';
import { request } from './api';
import './base.css';
import './style.css';

const base = '/api/admin/console/';
const sections = [
  ['overview','Overview',LayoutDashboard], ['resellers','Resellers',Users],
  ['devices','Devices',Monitor], ['plans','Reseller plans',Activity], ['coupon-packages','Coupon packages',Ticket],
  ['payment-methods','Payment methods',CreditCard],
];
const n = value => Number(value ?? 0).toLocaleString('en');
function date(value) {
  if (!value) return '—';
  const timestamp = new Date(value.length === 19 ? value.replace(' ', 'T') + 'Z' : value);
  return Number.isNaN(timestamp.valueOf()) ? '—' : timestamp.toLocaleDateString('en', {dateStyle:'medium',timeZone:'UTC'});
}
function readSession() {
  try { return JSON.parse(sessionStorage.getItem('velo-admin')); } catch { return null; }
}

function Login({ onLogin }) {
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const body = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const data = await request('/api/admin/login', {body});
      if (data.payload?.role !== 'admin') throw new Error('Administrator account required.');
      onLogin({token:data.result, admin:data.payload.name || body.email});
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <main className="login"><section className="login-brand"><Brand /><div className="login-intro">
    <h1>VeloTV<br/>Administration</h1><p>Manage reseller access, device growth and payments.</p>
  </div></section><section className="login-form"><form className="panel form" onSubmit={submit}>
    <h2>Administrator sign in</h2>
    <label>Email<input name="email" type="email" autoComplete="username" required /></label>
    <label>Password<input name="password" type="password" autoComplete="current-password" required maxLength={72} /></label>
    {error && <p role="alert" className="notice error">{error}</p>}
    <button className="primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
  </form></section></main>;
}
function Brand() {
  return <div className="brand"><div className="brand-icon"><Activity size={22}/></div>
    <div>VeloTV<span>Admin console</span></div></div>;
}
function Table({ headers, rows, empty = 'No records found.' }) {
  return rows.length ? <div className="table-scroll" role="region" aria-label="Results" tabIndex={0}>
    <table><thead><tr>{headers.map(header => <th key={header} scope="col">{header}</th>)}</tr></thead><tbody>{rows}</tbody></table>
  </div> : <p className="table-message">{empty}</p>;
}
function Overview({ data }) {
  const max = Math.max(1,...data.months.map(item => item.devices));
  return <>
    <div className="metrics admin-metrics">{[
      ['Registered devices',data.totals.devices],['User accounts',data.totals.users],
      ['Active resellers',data.totals.active_resellers],['Standalone trials',data.totals.trials],
    ].map(([label,value]) => <div className="panel metric" key={label}><p>{label}</p><strong>{n(value)}</strong></div>)}</div>
    <section className="panel section"><div className="section-head"><div><h2>Monthly growth</h2>
      <p className="muted">New device registrations and month-over-month change. Current month is in progress.</p></div></div>
      <div className="chart" aria-hidden="true">{data.months.map(item => <div key={item.month}>
        <span>{n(item.devices)}</span><div className="chart-bar" style={{height: Math.max(3, 105 * item.devices / max)}}/>
        <small>{item.month.slice(5)}</small>
      </div>)}</div>
      <Table headers={['Month (UTC)','New devices','Growth','New user accounts','New trials']}
        rows={[...data.months].reverse().map(item => <tr key={item.month}><td>{item.month}</td><td>{n(item.devices)}</td>
          <td>{item.growth == null ? '—' : `${item.growth > 0 ? '+' : ''}${item.growth}%`}</td><td>{n(item.users)}</td><td>{n(item.trials)}</td></tr>)} />
    </section>
    <section className="panel section"><div className="section-head"><h2>Recent admin activity</h2></div>
      <Table headers={['Date','Action','Admin ID','Record ID']} rows={data.activity.map(item =>
        <tr key={item.id}><td>{date(item.created_at)}</td><td>{item.action.replaceAll('_',' ')}</td><td>{item.admin_id}</td><td>{item.target_id ?? '—'}</td></tr>)}/>
    </section>
  </>;
}

const entityConfig = {
  plans: {
    label:'Reseller plan', list:'plans',
    fields:[['name','Name'],['duration_months','Duration in months','number',1,120,1],
      ['price','Price','number',0,99999999.99,.01],['currency','Currency code'],['enabled','Available for assignment','checkbox']],
  },
  'coupon-packages': {
    label:'Coupon package',list:'packages',
    fields:[['package_name','Name'],['package_amount','Price in credits','number',.001,99999.999,.001],
      ['periods','Months per coupon','number',1,120,1],['count_devices','Coupons per package','number',1,1000,1]],
  },
};
const methodNames = {credits:'Credit balance',paypal:'PayPal checkout',manual:'Manual paid credit top-ups'};
function Modal({ title, close, busy = false, wide = false, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const node = ref.current;
    node.showModal();
    return () => node.close();
  }, []);
  return <dialog ref={ref} className={'panel modal' + (wide ? ' detail-modal' : '')} aria-label={title}
    onCancel={event => {event.preventDefault();if (!busy) close();}}>
    <div className="section-head"><h2>{title}</h2><button className="secondary" onClick={close} disabled={busy}>Close</button></div>
    {children}
  </dialog>;
}

function Editor({ seed, plans, save, close }) {
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const { kind, row, action } = seed;
  const entity = entityConfig[kind];
  const resellerPath = 'resellers/' + row?.id;
  const title = entity ? (row ? 'Edit ' : 'New ') + entity.label :
    kind === 'profile' ? (row ? 'Edit reseller' : 'Add reseller') :
    kind === 'membership' ? ({assign:'Assign plan',pause:'Pause access',resume:'Resume access',archive:'Archive reseller'})[action] :
    kind === 'credit' ? 'Adjust reseller balance' : methodNames[row.method];

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const fields = new FormData(event.currentTarget);
    const body = Object.fromEntries(fields);
    let path, method = row ? 'PATCH' : 'POST';
    if (entity) {
      path = kind + (row ? '/' + row.id : '');
      for (const [key,,type] of entity.fields) {
        if (type === 'number') body[key] = Number(body[key]);
        if (type === 'checkbox') body[key] = fields.has(key);
      }
    } else if (kind === 'profile') {
      path = row ? resellerPath : 'resellers';
      if (row && !body.password) delete body.password;
      if (!row) body.plan_id = Number(body.plan_id);
    } else if (kind === 'membership') {
      path = resellerPath + '/membership';
      method = 'POST';
      body.action = action;
      if (action === 'assign') body.plan_id = Number(body.plan_id);
    } else if (kind === 'credit') {
      path = '/reseller/paybalance/newbalance';
      method = 'POST';
      body.reseller_id = row.id;
      if (body.kind === 'gift') { delete body.paidAmount; delete body.currency; }
    } else {
      path = 'payment-methods/' + row.method;
      body.enabled = fields.has('enabled');
    }
    setBusy(true);
    setError('');
    try { await save(path,{method,body}); close(true); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  const [paid,setPaid] = useState(false);
  const planPicker = <label>Reseller plan<select required name="plan_id" defaultValue="">
    <option value="">Choose a plan</option>{plans.filter(plan => plan.enabled).map(plan =>
      <option key={plan.id} value={plan.id}>{plan.name} · {plan.duration_months} mo · {plan.price} {plan.currency}</option>)}
    </select></label>;
  return <Modal title={title} busy={busy} close={() => close()}>
    <form className="form dialog-form" onSubmit={submit}><fieldset disabled={busy}>
      {entity?.fields.map(([key,name,type,min,max,step]) => type === 'checkbox' ?
        <label className="check" key={key}><input type="checkbox" name={key} defaultChecked={row ? Boolean(row[key]) : true}/>{name}</label> :
        <label key={key}>{name}<input name={key} type={type || 'text'} min={min} max={max} step={step}
          defaultValue={row?.[key] ?? (key === 'currency' ? 'EUR' : '')} required maxLength={key === 'currency' ? 3 : 120}/></label>)}
      {kind === 'profile' && <>
        <label>Username<input name="username" required minLength={2} maxLength={120} defaultValue={row?.username}/></label>
        <label>Email<input name="email" required type="email" maxLength={255} defaultValue={row?.email}/></label>
        <label>Phone<input name="phone" maxLength={50} defaultValue={row?.phone}/></label>
        <label>{row ? 'New password (optional)' : 'Password'}<input type="password" name="password" required={!row}
          autoComplete="new-password" minLength={10} maxLength={72}/></label>
        {!row && planPicker}
      </>}
      {kind === 'membership' && <>
        <p className="muted">{row.username} · {action === 'assign' ? 'The plan starts today.' :
          action === 'resume' ? 'Restore dashboard access.' : 'Dashboard access stops. Device and payment records are kept.'}</p>
        {action === 'assign' && planPicker}
      </>}
      {kind === 'method' && <>
        <label className="check"><input type="checkbox" name="enabled" defaultChecked={Boolean(row.enabled)}/> Enabled</label>
        <label>Internal instructions<textarea name="instructions" maxLength={1000} rows={3} defaultValue={row.instructions}/></label>
      </>}
      {kind === 'credit' && <>
        <label>Adjustment type<select name="kind" onChange={event => setPaid(event.target.value === 'manual_paid')}>
          <option value="gift">Gift</option><option value="manual_paid">Manual payment</option></select></label>
        <label>Credits<input type="number" min=".00001" max="99999.99999" step=".00001" name="amount" required/></label>
        <label>Unique reference<input name="paymentId" required maxLength={128}/></label>
        {paid && <div className="form-row"><label>Paid amount<input name="paidAmount" type="number" min=".01" step=".01" required/></label>
          <label>Currency<input name="currency" defaultValue="EUR" pattern="[A-Za-z]{3}" required/></label></div>}
      </>}
      {error && <p className="notice error" role="alert">{error}</p>}
      <button className="primary">{busy ? 'Saving…' : 'Confirm'}</button>
    </fieldset></form>
  </Modal>;
}

function Console({ session, logout }) {
  const [section,setSection] = useState('overview');
  const [data,setData] = useState(null);
  const [plans,setPlans] = useState([]);
  const [edit,setEdit] = useState(null);
  const [details,setDetails] = useState(null);
  const [status,setStatus] = useState('');
  const [error,setError] = useState('');
  const [search,setSearch] = useState('');
  const [page,setPage] = useState(0);
  const [revision,refresh] = useState(0);
  const call = (path, options) => request(path.startsWith('/') ? path : base + path, {token:session.token,...options})
    .catch(err => { if (err.status === 401) logout(); throw err; });

  useEffect(() => {
    const controller = new AbortController();
    const options = {signal:controller.signal};
    const query = new URLSearchParams({search,page});
    setData(null);
    setError('');
    Promise.all([call(['resellers','devices'].includes(section) ? section + '?' + query : section, options),
      section === 'resellers' ? call('plans',options) : Promise.resolve({plans:[]})])
      .then(([result, catalog]) => { if (!controller.signal.aborted) { setData(result); setPlans(catalog.plans); } })
      .catch(failure => { if (!controller.signal.aborted) setError(failure.message); });
    return () => controller.abort();
  }, [section, page, search, revision]);

  async function inspect(row) {
    setDetails({row,loading:true});
    try {
      const result = await call('/api/admin/resellers/' + row.id + '/credit-report');
      setDetails(current => current?.row.id === row.id ? {row,result} : current);
    } catch (failure) {
      setDetails(current => current?.row.id === row.id ? {row,error:failure.message} : current);
    }
  }

  const entity = entityConfig[section];
  const planNames = new Map(plans.map(plan => [plan.id,plan.name]));
  return <div className="shell admin-shell"><aside className="sidebar"><Brand/>
    <nav aria-label="Admin">{sections.map(([id,label,Icon]) => <button key={id} aria-current={id === section ? 'page' : undefined}
      className={id === section ? 'current' : ''} onClick={() => {if (id !== section) setData(null);setSection(id);setPage(0);setSearch('');setStatus('');}}>
      <Icon size={18}/>{label}</button>)}</nav>
    <div className="sidebar-foot"><button onClick={logout}><LogOut size={18}/>Sign out</button></div></aside>
    <main className="main"><header className="topbar"><span>{session.admin}</span><button className="icon-button" aria-label="Refresh"
      onClick={() => refresh(value => value + 1)}><RefreshCw size={17}/></button></header><div className="content">
      <div className="page-head"><h1>{sections.find(item => item[0] === section)[1]}</h1>
        {entity && <button className="primary" onClick={() => setEdit({kind:section})}><Plus size={17}/>Add {entity.label.toLowerCase()}</button>}
        {section === 'resellers' && <button className="primary" disabled={!plans.some(plan => plan.enabled)}
          onClick={() => setEdit({kind:'profile'})}><Plus size={17}/>Add reseller</button>}</div>
      {status && <p role="status" className="notice success">{status}</p>}
      {error && <p role="alert" className="notice error">{error}</p>}
      {!data && !error && <p role="status">Loading…</p>}
      {data && section === 'overview' && <Overview data={data}/>}
      {data && section === 'devices' && <section className="panel section">
        <form className="toolbar" onSubmit={event => {event.preventDefault();setPage(0);setSearch(new FormData(event.currentTarget).get('search'));}}>
          <input name="search" aria-label="Search devices" defaultValue={search} maxLength={120} placeholder="Search by Android ID or MAC"/>
          <button className="secondary">Search</button>
        </form>
        <Table headers={['Device','Type','Status','Latest reseller','Registered','Expires']} rows={data.rows.map(row =>
          <tr key={row.id}><td><strong>{row.android_id || row.mac || '#' + row.id}</strong></td><td>{row.type}</td>
            <td><span className={'state state-' + row.state}>{row.state}</span></td><td>{row.reseller || '—'}</td>
            <td>{date(row.created_at)}</td><td>{date(row.expires_at)}</td></tr>)}/>
        <div className="pagination"><span>{n(data.count)} devices</span><button className="secondary" disabled={!page} onClick={() => setPage(page-1)}>Previous</button>
          <button className="secondary" disabled={(page+1)*50 >= data.count} onClick={() => setPage(page+1)}>Next</button></div>
      </section>}
      {data && section === 'resellers' && <section className="panel section">
        <form className="toolbar" onSubmit={event => {event.preventDefault();setPage(0);setSearch(new FormData(event.currentTarget).get('search'));}}>
          <input name="search" aria-label="Search resellers" defaultValue={search} maxLength={120} placeholder="Search name, email or phone"/>
          <button className="secondary">Search</button>
        </form>
        {!plans.some(plan => plan.enabled) && <p className="table-message">Create an enabled reseller plan to add a reseller.</p>}
        <Table headers={['Reseller','Plan','Status','Expires','Devices','Users','Playlists added','Manage']} rows={data.rows.map(row => <tr key={row.id}>
          <td><strong>{row.username}</strong><small>{row.email}</small></td><td>{planNames.get(row.plan_id) || '—'}</td>
          <td><span className={'state state-' + row.state}>{row.state}</span></td><td>{date(row.expires_at)}</td>
          <td>{n(row.devices)}</td><td>{n(row.users)}</td><td>{n(row.playlists)}</td><td><div className="row-actions">
            <button className="text-button" onClick={() => inspect(row)}>Details</button>
            <button className="text-button" onClick={() => setEdit({kind:'profile',row})}>Edit</button>
            <button className="text-button" disabled={!plans.some(plan => plan.enabled)}
              onClick={() => setEdit({kind:'membership',row,action:'assign'})}>Assign plan</button>
            <button className="text-button" onClick={() => setEdit({kind:'credit',row})}>Credits</button>
            {(row.state === 'active' || row.state === 'legacy') && <button className="text-button"
              onClick={() => setEdit({kind:'membership',row,action:'pause'})}>Pause</button>}
            {['paused','archived'].includes(row.state) && <button className="text-button"
              onClick={() => setEdit({kind:'membership',row,action:'resume'})}>Resume</button>}
            {row.state !== 'archived' && <button className="text-button danger"
              onClick={() => setEdit({kind:'membership',row,action:'archive'})}>Archive</button>}
          </div></td></tr>)}/>
        <div className="pagination"><span>{n(data.count)} resellers</span><button className="secondary" disabled={!page} onClick={() => setPage(page-1)}>Previous</button>
          <button className="secondary" disabled={(page+1)*50 >= data.count} onClick={() => setPage(page+1)}>Next</button></div>
      </section>}
      {data && entity && <section className="panel section"><Table headers={[...entity.fields.map(field => field[1]),'Manage']}
        rows={data[entity.list].map(row => <tr key={row.id}>{entity.fields.map(([key,,type]) =>
          <td key={key}>{type === 'checkbox' ? (row[key] ? 'Enabled' : 'Disabled') : row[key]}</td>)}
          <td><button className="text-button" onClick={() => setEdit({kind:section,row})}>Edit</button></td></tr>)}/></section>}
      {data && section === 'payment-methods' && <section className="panel section">
        {!data.paypalConfigured && <p className="table-message">PayPal credentials are required on the API server before accepting checkout.</p>}
        <Table headers={['Payment method','Status','Internal instructions','Manage']} rows={data.methods.map(row => <tr key={row.method}>
          <td>{methodNames[row.method]}</td><td>{row.enabled ? 'Enabled' : 'Disabled'}</td><td>{row.instructions || '—'}</td>
          <td><button className="text-button" onClick={() => setEdit({kind:'method',row})}>Edit</button></td></tr>)}/>
      </section>}
    </div></main>
    {edit && <Editor seed={edit} plans={plans} save={call} close={saved => {
      setEdit(null); if (saved) {setStatus('Changes saved.');refresh(value => value + 1);}
    }}/>}
    {details && <Modal title={details.row.username} close={() => setDetails(null)} wide>
      {details.loading && <p className="table-message" role="status">Loading…</p>}
      {details.error && <p className="notice error" role="alert">{details.error}</p>}
      {details.result && <div className="dialog-form">
        <p>Balance <strong>{details.result.balance}</strong> · {n(details.row.devices)} devices · {n(details.row.users)} linked users · {n(details.row.playlists)} playlists added</p>
        <h2>Recent activations</h2><Table headers={['Device ID','Coupon ID','Months','Date']} rows={details.result.activations.map(item =>
          <tr key={item.id}><td>{item.id_device}</td><td>{item.id_coupon}</td><td>{item.duration}</td><td>{date(item.created_at)}</td></tr>)}/>
        <h2>Balance payments</h2><Table headers={['Date','Reference','Method','Amount']} rows={details.result.payments.map(item =>
          <tr key={item.id}><td>{date(item.created_at)}</td><td>{item.paymentID}</td><td>{item.methode}</td><td>{item.payment_amount}</td></tr>)}/>
        <h2>Package payments</h2><Table headers={['Date','Reference','Package','Amount']} rows={details.result.packagePayments.map(item =>
          <tr key={item.id}><td>{date(item.createdtime)}</td><td>{item.paymentID}</td><td>{item.packages}</td><td>{item.payment_amount}</td></tr>)}/>
        <h2>Credit history</h2><Table headers={['Date','Description','Balance']} rows={details.result.ledger.map(item =>
          <tr key={item.id}><td>{date(item.created_at)}</td><td>{item.message}</td><td>{item.newcredits}</td></tr>)}/>
      </div>}
    </Modal>}
  </div>;
}

function App() {
  const [session,setSession] = useState(readSession);
  function change(value) {
    if (value) sessionStorage.setItem('velo-admin',JSON.stringify(value));
    else sessionStorage.removeItem('velo-admin');
    setSession(value);
  }
  return session ? <Console session={session} logout={() => change(null)}/> : <Login onLogin={change}/>;
}
createRoot(document.getElementById('root')).render(<App/>);
