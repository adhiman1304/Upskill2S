import { featuredProviders, ProviderLogo } from '../legacy/providers'

// Providers in the seed catalog. Anthropic is a legacy library tile with no exams in the catalog yet.
const providers = [
  ...featuredProviders.filter((provider) => provider.name !== 'Anthropic'),
  { name: 'HashiCorp', domain: 'hashicorp.com', detail: 'Terraform · Vault' },
  { name: 'Salesforce', domain: 'salesforce.com' },
  { name: 'Databricks', domain: 'databricks.com' },
  { name: 'Snowflake', domain: 'snowflake.com' },
]

export function ProviderBrowse({ onPick }: { onPick: (provider: string) => void }) {
  return <section className="home-section" aria-labelledby="providers-heading">
    <div className="section-heading"><div><h2 id="providers-heading">Browse by provider</h2><p>Pick a provider to see its exams in the search above.</p></div></div>
    <div className="home-provider-grid">{providers.map((provider) => <button type="button" className="home-provider-tile" key={provider.name} onClick={() => onPick(provider.name)}>
      <span className="provider-logo home-logo"><ProviderLogo name={provider.name} domain={provider.domain} /></span>
      <span><strong>{provider.name}</strong>{'detail' in provider && provider.detail && <small>{provider.detail}</small>}</span>
    </button>)}</div>
  </section>
}
