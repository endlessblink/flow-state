// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseInput from '@/components/base/BaseInput.vue'

describe('BaseInput.vue', () => {
  it('associates helper text with input via aria-describedby', () => {
    const helperText = 'Please enter a valid email'
    const wrapper = mount(BaseInput, {
      props: {
        helperText,
        id: 'test-input'
      }
    })

    const input = wrapper.find('input')
    const helper = wrapper.find('.helper-text')

    expect(helper.exists()).toBe(true)
    expect(helper.text()).toBe(helperText)

    const helperId = helper.attributes('id')
    expect(helperId).toBe('test-input-helper')
    expect(input.attributes('aria-describedby')).toBe(helperId)
  })

  it('does not apply aria-describedby when helper text is missing', () => {
    const wrapper = mount(BaseInput, {
      props: {
        id: 'test-input-no-helper'
      }
    })

    const input = wrapper.find('input')
    const helper = wrapper.find('.helper-text')

    expect(helper.exists()).toBe(false)
    expect(input.attributes('aria-describedby')).toBeFalsy()
  })
})
