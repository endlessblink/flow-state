export class ConflictDetector {
    getDeviceId(): string {
        return 'stub-device-id'
    }

    async detectAllConflicts(): Promise<any[]> {
        return []
    }
}
