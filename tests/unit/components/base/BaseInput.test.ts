// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import BaseInput from '@/components/base/BaseInput.vue'

describe('BaseInput.vue', () => {
  it('links helper text to input via aria-describedby', () => {
    const helperText = 'This is a helper text'
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

    // Check if aria-describedby is present and matches helper id
    const describedBy = input.attributes('aria-describedby')
    const helperId = helper.attributes('id')

    // This expectation is expected to fail before the fix
    expect(describedBy).toBeTruthy()
    expect(helperId).toBeTruthy()
    expect(describedBy).toBe(helperId)
  })

  it('does not have aria-describedby when helperText is missing', () => {
    const wrapper = mount(BaseInput, {
      props: {
        id: 'test-input-no-helper'
      }
    })

    const input = wrapper.find('input')
    expect(input.attributes('aria-describedby')).toBeFalsy()
  })
})
