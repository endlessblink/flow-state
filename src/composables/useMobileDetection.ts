import { ref, onMounted, onUnmounted } from 'vue'
import { MOBILE_BREAKPOINT_PX } from '@/constants/breakpoints'

// Check mobile immediately (SSR-safe)
function getInitialMobileState(): boolean {
    if (typeof window === 'undefined') return false

    const userAgent = navigator.userAgent || navigator.vendor || window.opera || ''
    const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase())
    const isSmallScreen = window.innerWidth <= MOBILE_BREAKPOINT_PX
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0

    return isMobileDevice || (isSmallScreen && isTouch)
}

export function useMobileDetection() {
    // Initialize with correct value immediately (not false)
    const isMobile = ref(getInitialMobileState())

    const checkMobile = () => {
        if (typeof window === 'undefined') return

        // Check for mobile user agent
        const userAgent = navigator.userAgent || navigator.vendor || window.opera || ''
        const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase())

        // Check for small screen width (standard tablet/mobile breakpoint)
        const isSmallScreen = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX}px)`).matches

        // Check for touch capability (additional signal)
        const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0

        // Combine signals: mobile UA always gets mobile layout; narrow screen only
        // triggers mobile layout when touch is also present (prevents desktop browsers
        // resized to 768px from falsely triggering mobile UI).
        isMobile.value = isMobileDevice || (isSmallScreen && isTouch)

        console.log('[MobileDetection] Checked:', {
            isMobile: isMobile.value,
            isMobileDevice,
            isSmallScreen,
            isTouch,
            width: window.innerWidth
        })
    }

    onMounted(() => {
        checkMobile()
        window.addEventListener('resize', checkMobile)
    })

    onUnmounted(() => {
        window.removeEventListener('resize', checkMobile)
    })

    return { isMobile }
}
