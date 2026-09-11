export class StorefrontOrderEmailSimulationService {
  simulateConfirmation(recipientEmail: string): { sent: boolean } {
    return { sent: Boolean(recipientEmail.trim()) };
  }
}
