import { useState } from 'react';
import { planCatalog, planPrice, type BillingPeriod } from './planCatalog';
import './plans.css';
type Props = { onPreview?: (plan: string) => void; linkToDemo?: boolean };
export default function PlanPreview({ onPreview, linkToDemo = false }: Props) {
  const [period, setPeriod] = useState<BillingPeriod>('annually');
  const otherPeriod = period === 'annually' ? 'monthly' : 'annually';
  return <div className="pricing-preview">
    <div className="pricing-toolbar"><div><strong>A plan for every kind of home.</strong><span>Choose monthly or annual billing.</span></div><div className="pricing-period" role="group" aria-label="Billing period"><button type="button" aria-pressed={period === 'monthly'} onClick={() => setPeriod('monthly')}>Monthly</button><button type="button" aria-pressed={period === 'annually'} onClick={() => setPeriod('annually')}>Annually</button></div></div>
    <div className="pricing-grid">{planCatalog.map(plan => {
      const free = plan.id === 'free';
      const bestValue = plan.id === 'single';
      return <section className={'pricing-card pricing-' + plan.id} key={plan.id} aria-label={plan.name + ' plan'}>
        <div className="pricing-card-heading"><span className="pricing-mark" aria-hidden="true">{free ? '◇' : plan.id === 'single' ? '▣' : '♧'}</span>{free ? <span className="pricing-tag">Ad-supported</span> : bestValue && period === 'annually' ? <span className="pricing-tag pricing-best">Best Value</span> : <span className="pricing-tag">{period === 'monthly' ? 'Monthly plan' : 'Annual plan'}</span>}</div>
        <h3>{plan.name}</h3><p className="pricing-description">{plan.description}</p>
        <div className="pricing-amount"><strong>{planPrice(plan[period])}</strong>{!free && <span>/ {period === 'monthly' ? 'month' : 'year'}</span>}</div>
        <p className="pricing-billing">{free ? 'Free · advertisement-supported' : period === 'monthly' ? 'Billed Monthly' : 'Billed Annually'}</p>
        <div className="pricing-alternative">{free ? <span>Limited storage containers</span> : <><span><strong>{planPrice(plan[otherPeriod])}</strong> / {otherPeriod === 'monthly' ? 'month' : 'year'}<small>{otherPeriod === 'monthly' ? 'Billed Monthly' : 'Billed Annually'}</small></span>{bestValue && otherPeriod === 'annually' && <span className="pricing-tag pricing-best">Best Value</span>}</>}</div>
        <ul>{plan.features.map(feature => <li key={feature}><span aria-hidden="true">✓</span>{feature}</li>)}</ul>
        {linkToDemo ? <a className="pricing-action" href={free ? '#/login' : '#/login?username=' + (plan.id === 'single' ? 'single%20user' : 'family%20user')}>{free ? 'Try the Free preview' : 'Explore ' + plan.name}<span aria-hidden="true">→</span></a> : onPreview ? <button type="button" className="pricing-action" onClick={() => onPreview(plan.name + (free ? '' : ' · ' + (period === 'monthly' ? 'Billed Monthly' : 'Billed Annually')))}>View plan (preview)<span aria-hidden="true">→</span></button> : <div className="pricing-readonly">Plan catalog · preview only</div>}
      </section>;
    })}</div>
    <p className="pricing-footnote">Pricing preview only. Payments, subscriptions and advertising delivery are not connected.</p>
  </div>;
}
