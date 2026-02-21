import { ref, onMounted, onUnmounted } from 'vue'

// Check mobile immediately (SSR-safe)
function getInitialMobileState(): boolean {
    if (typeof window === 'undefined') return false

    const userAgent = navigator.userAgent || navigator.vendor || window.opera
    const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase())
    const isSmallScreen = window.innerWidth <= 768

    return isMobileDevice || isSmallScreen
}

export function useMobileDetection() {
    // Initialize with correct value immediately (not false)
    const isMobile = ref(getInitialMobileState())

    const checkMobile = () => {
        if (typeof window === 'undefined') return

        // Check for mobile user agent
        const userAgent = navigator.userAgent || navigator.vendor || window.opera
        const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase())

        // Check for small screen width (standard tablet/mobile breakpoint)
        const isSmallScreen = window.matchMedia('(max-width: 768px)').matches

        // Check for touch capability (additional signal)
        const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0

        // Combine signals - prioritize screen size/agent over touch
        // RELAXED: If it's small, it's mobile. If it's a mobile UA, it's mobile.
        isMobile.value = isMobileDevice || isSmallScreen

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
