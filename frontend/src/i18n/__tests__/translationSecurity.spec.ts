import { createI18n } from 'vue-i18n'
import { describe, expect, it } from 'vitest'

// Exercise the real installed runtime/JIT distribution used by the app alias,
// not a mocked translator. Payloads are inert markup, never scripts.
// 验证实际运行时依赖；只使用惰性模板里的无害标记，不执行脚本。

function expectNoActiveSrcdoc(translated: string): void {
  const template = document.createElement('template')
  template.innerHTML = translated
  const iframe = template.content.querySelector('iframe')
  expect(iframe).not.toBeNull()
  expect(iframe?.hasAttribute('srcdoc')).toBe(false)
}

describe('installed Vue I18n security and composition compatibility', () => {
  it.each(['srcdoc', 'SRCDOC'])('neutralizes %s in HTML translations (GHSA-83rm-6c8r-g728)', (attribute) => {
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      escapeParameter: true,
      warnHtmlMessage: false,
      messages: { en: { message: `<iframe ${attribute}="<b>fixture</b>"></iframe>` } }
    })

    expectNoActiveSrcdoc(i18n.global.t('message'))
  })

  it('neutralizes srcdoc when the nested markup comes from an interpolation parameter', () => {
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      escapeParameter: true,
      warnHtmlMessage: false,
      messages: { en: { message: '<iframe srcdoc="{content}"></iframe>' } }
    })

    expectNoActiveSrcdoc(i18n.global.t('message', { content: '<b>fixture</b>' }))
  })

  it('preserves named interpolation, pluralization and changing between English and Chinese', () => {
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      fallbackLocale: 'en',
      messages: {
        en: { greeting: 'Hello, {name}!', requests: 'No requests | One request | {count} requests' },
        zh: { greeting: '你好，{name}！', requests: '{count} 次请求' }
      }
    })

    expect(i18n.global.t('greeting', { name: 'Member' })).toBe('Hello, Member!')
    expect(i18n.global.t('requests', 2)).toBe('2 requests')
    i18n.global.locale.value = 'zh'
    expect(i18n.global.t('greeting', { name: '成员' })).toBe('你好，成员！')
    expect(i18n.global.t('requests', 2)).toBe('2 次请求')
  })
})
