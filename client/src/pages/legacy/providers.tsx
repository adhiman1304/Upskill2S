/* eslint-disable react-refresh/only-export-components -- shared provider data lives next to the logo component */
import { useState } from 'react'

export const featuredProviders = [
  { name: 'Microsoft', domain: 'microsoft.com' },
  { name: 'AWS', domain: 'aws.amazon.com', detail: 'Amazon Web Services' },
  { name: 'Google Cloud', domain: 'cloud.google.com' },
  { name: 'Cisco', domain: 'cisco.com' },
  { name: 'CompTIA', domain: 'comptia.org' },
  { name: 'PeopleCert', domain: 'peoplecert.org', detail: 'ITIL · PRINCE2' },
  { name: 'PMI', domain: 'pmi.org', detail: 'Project Management Institute' },
  { name: 'ISC2', domain: 'isc2.org' },
  { name: 'ISACA', domain: 'isaca.org' },
  { name: 'Linux Foundation', domain: 'linuxfoundation.org' },
  { name: 'Red Hat', domain: 'redhat.com' },
  { name: 'Oracle', domain: 'oracle.com' },
]

export const providerLogoDomains: Record<string, string> = {
  adobe: 'adobe.com', amazon: 'aws.amazon.com', 'amazon web services': 'aws.amazon.com', anthropic: 'anthropic.com', apple: 'apple.com',
  atlassian: 'atlassian.com', aws: 'aws.amazon.com', cisco: 'cisco.com', comptia: 'comptia.org',
  google: 'google.com', 'google cloud': 'cloud.google.com', gcp: 'cloud.google.com', hashicorp: 'hashicorp.com',
  ibm: 'ibm.com', isc2: 'isc2.org', isaca: 'isaca.org', juniper: 'juniper.net', 'juniper networks': 'juniper.net',
  'linux foundation': 'linuxfoundation.org', microsoft: 'microsoft.com', 'microsoft azure': 'microsoft.com',
  oracle: 'oracle.com', peoplecert: 'peoplecert.org', pmi: 'pmi.org', 'project management institute': 'pmi.org',
  'red hat': 'redhat.com', salesforce: 'salesforce.com', sap: 'sap.com', vmware: 'vmware.com', azure: 'microsoft.com',
}

export function ProviderLogo({ name, domain }: { name: string; domain?: string }) {
  const logoDomain = domain ?? providerLogoDomains[name.toLowerCase()]
  const [logoFailed, setLogoFailed] = useState(false)
  return logoDomain && !logoFailed ? <img src={`https://www.google.com/s2/favicons?domain=${logoDomain}&sz=128`} alt="" aria-hidden="true" loading="lazy" onError={() => setLogoFailed(true)} /> : <span aria-hidden="true">{name.trim().slice(0, 1).toUpperCase()}</span>
}
