import React, { useEffect, useRef, useState } from 'react';
import { money, snapshot, timestamp } from './commerce';

function PurchaseDetails({ row, close }) {
  const ref = useRef(null);
  useEffect(() => { const node=ref.current; node.showModal(); return () => node.close(); },[]);
  const terms = snapshot(row);
  return <dialog className="purchase-dialog" ref={ref} aria-labelledby="purchase-title" onCancel={close}>
    <div className="section-head"><h2 id="purchase-title">Purchase details</h2><button className="secondary" onClick={close}>Close</button></div>
    <p className="muted">These terms were saved when checkout started.</p>
    <dl className="purchase-details">{[
      ['Purchase ID',row.id],['Package',terms.package_name || '#'+row.package_id],
      ['Reseller ID',row.reseller_id],['Status',row.status],['Channel',row.channel === 'wallet' ? 'EUR wallet' : 'PayPal'],
      ['Base price',money(row.base_amount,row.currency)],['Checkout amount',money(row.amount,row.currency)],
      ['Activations',row.coupon_count],['Months per device',row.duration],
      ['Offer',terms.offer_name || 'No offer'],['Offer ID',row.offer_id || '—'],
      ['Offer starts',timestamp(terms.offer_starts_at)],['Offer ends',timestamp(terms.offer_ends_at)],
      ['Offer purchase limit',terms.max_purchases_per_reseller ?? 'No limit'],
      ['Offer audience',terms.audience || '—'],['Created',timestamp(row.created_at)],
      ['Completed',timestamp(row.fulfilled_at)],['Reference',row.reference],
    ].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    {row.status==='pending' && <p className="notice">Payment is not confirmed. This PayPal reservation counts toward the offer limit. Contact support if checkout was abandoned.</p>}
  </dialog>;
}

export default function PurchaseHistory({ api, admin = false, revision = 0 }) {
  const [filters,setFilters] = useState({ reseller:'',pack:'' });
  const [page,setPage] = useState(0);
  const [state,setState] = useState({ loading:true,rows:[],count:0,error:'' });
  const [details,setDetails] = useState(null);
  const params = new URLSearchParams({ page });
  if (admin && filters.reseller) params.set('reseller_id',filters.reseller);
  if (filters.pack) params.set('package_id',filters.pack);
  const path = (admin ? '/api/admin/console/package-purchases?' : '/reseller/dashboard/package-purchases?') + params;
  useEffect(() => {
    const controller = new AbortController();
    setState({ loading:true,rows:[],count:0,error:'' });
    api(path,{ signal:controller.signal }).then(data => {
      if (!controller.signal.aborted) setState({ loading:false,rows:data.rows,count:data.count,error:'' });
    }).catch(error => {
      if (!controller.signal.aborted) setState({ loading:false,rows:[],count:0,error:error.message });
    });
    return () => controller.abort();
  },[api,path,revision]);
  return <section className="panel section purchase-history">
    <div className="section-head"><div><h2>Package purchase history</h2><p className="muted">Prices, offers and activation terms saved at checkout. Includes wallet and PayPal purchases.</p></div></div>
    <form className="toolbar" onSubmit={event => {
      event.preventDefault(); const values=new FormData(event.currentTarget);
      setFilters({ reseller:values.get('reseller') || '',pack:values.get('pack') || '' });setPage(0);
    }}>
      {admin && <label>Reseller ID<input name="reseller" type="number" min="1" max="2147483647" step="1" placeholder="All resellers"/></label>}
      <label>Package ID<input name="pack" type="number" min="1" max="2147483647" step="1" placeholder="All packages"/></label>
      <button className="secondary">Apply filters</button>
    </form>
    {state.loading ? <p role="status" className="table-message">Loading purchases…</p> : state.error ? <p role="alert" className="notice error">{state.error}</p> : !state.rows.length ?
      <p className="table-message">No purchases match these filters. Purchases before the offers update remain in the existing payment and balance history.</p> :
      <div className="table-scroll" role="region" tabIndex="0" aria-label="Package purchase history"><table><thead><tr>
        {['Created (UTC)','Package',...(admin ? ['Reseller'] : []),'Offer','Base price','Checkout amount','Activations','Months each','Channel','Status','Details'].map(title=><th key={title}>{title}</th>)}
      </tr></thead><tbody>{state.rows.map(row => {
        const terms=snapshot(row);
        return <tr key={row.id}><td>{timestamp(row.created_at)}</td><td><strong>{terms.package_name || '#'+row.package_id}</strong><small>#{row.package_id}</small></td>
          {admin && <td>#{row.reseller_id}</td>}<td>{terms.offer_name || '—'}</td><td>{money(row.base_amount,row.currency)}</td><td>{money(row.amount,row.currency)}</td>
          <td>{row.coupon_count}</td><td>{row.duration}</td><td>{row.channel === 'wallet' ? 'EUR wallet' : 'PayPal'}</td>
          <td><span className={'state state-'+row.status}>{row.status === 'fulfilled' ? 'Completed' : row.status === 'pending' ? 'Pending payment' : row.status}</span></td>
          <td><button className="text-button" onClick={()=>setDetails(row)}>View details</button></td></tr>;
      })}</tbody></table></div>}
    <div className="pagination"><span>{state.count} purchases · Page {page+1}</span>
      <button className="secondary" disabled={state.loading || page===0} onClick={()=>setPage(page-1)}>Previous</button>
      <button className="secondary" disabled={state.loading || (page+1)*100>=state.count} onClick={()=>setPage(page+1)}>Next</button></div>
    {details && <PurchaseDetails row={details} close={()=>setDetails(null)}/>}
  </section>;
}
