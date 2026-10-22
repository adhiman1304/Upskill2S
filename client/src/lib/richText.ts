import DOMPurify from 'dompurify'

export function descriptionHtml(description: string) {
  if (/<\/?[a-z][^>]*>/i.test(description)) return DOMPurify.sanitize(description)
  return description.split('\n').map((line) => `<p>${line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') || '<br>'}</p>`).join('')
}
