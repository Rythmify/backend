// ============================================================
// tests/notifications/services/email-notifications.service.test.js
// Coverage Target: 100%
// ============================================================

const emailNotifService = require('../../../src/services/email-notifications.service');
const notificationModel = require('../../../src/models/notification.model');
const { sendDirectMessageNotificationEmail, sendGeneralNotificationEmail } = require('../../../src/utils/mailer');

jest.mock('../../../src/models/notification.model');
jest.mock('../../../src/utils/mailer');
jest.mock('../../../src/config/env', () => ({
  APP_URL: 'https://test.com'
}));

describe('Email Notifications Service', () => {
  const mockRecipient = {
    email: 'recip@test.com',
    display_name: 'Recipient'
  };
  const mockSender = {
    display_name: 'Sender'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sendDirectMessageEmailIfEligible', () => {
    it('returns if recipientSettings missing', async () => {
      notificationModel.getUserEmailNotificationSettings.mockResolvedValue(null);
      await emailNotifService.sendDirectMessageEmailIfEligible({ recipientId: 'r' });
      expect(sendDirectMessageNotificationEmail).not.toHaveBeenCalled();
    });

    it('returns if sender missing', async () => {
      notificationModel.getUserEmailNotificationSettings.mockResolvedValue(mockRecipient);
      notificationModel.getUserEmailIdentity.mockResolvedValue(null);
      await emailNotifService.sendDirectMessageEmailIfEligible({ senderId: 's' });
      expect(sendDirectMessageNotificationEmail).not.toHaveBeenCalled();
    });

    it('returns if email not enabled', async () => {
      notificationModel.getUserEmailNotificationSettings.mockResolvedValue({ ...mockRecipient, email: null });
      notificationModel.getUserEmailIdentity.mockResolvedValue(mockSender);
      await emailNotifService.sendDirectMessageEmailIfEligible({ recipientId: 'r', senderId: 's' });
      expect(sendDirectMessageNotificationEmail).not.toHaveBeenCalled();
    });

    it('returns if preference for DM is disabled', async () => {
      notificationModel.getUserEmailNotificationSettings.mockResolvedValue({ ...mockRecipient, new_message_email: false });
      notificationModel.getUserEmailIdentity.mockResolvedValue(mockSender);
      await emailNotifService.sendDirectMessageEmailIfEligible({ recipientId: 'r', senderId: 's' });
      expect(sendDirectMessageNotificationEmail).not.toHaveBeenCalled();
    });

    it('sends email on success', async () => {
      notificationModel.getUserEmailNotificationSettings.mockResolvedValue({ ...mockRecipient, new_message_email: true });
      notificationModel.getUserEmailIdentity.mockResolvedValue(mockSender);
      await emailNotifService.sendDirectMessageEmailIfEligible({ conversationId: 'c1', recipientId: 'r', senderId: 's' });
      expect(sendDirectMessageNotificationEmail).toHaveBeenCalled();
    });

    it('handles send failure gracefully', async () => {
      notificationModel.getUserEmailNotificationSettings.mockResolvedValue({ ...mockRecipient, new_message_email: true });
      notificationModel.getUserEmailIdentity.mockResolvedValue(mockSender);
      sendDirectMessageNotificationEmail.mockRejectedValue(new Error('fail'));
      await emailNotifService.sendDirectMessageEmailIfEligible({ conversationId: 'c1', recipientId: 'r', senderId: 's' });
      // should not throw
    });

    it('handles query failure gracefully', async () => {
      notificationModel.getUserEmailNotificationSettings.mockRejectedValue(new Error('db fail'));
      await emailNotifService.sendDirectMessageEmailIfEligible({ recipientId: 'r' });
      // should not throw
    });
  });

  describe('sendGeneralNotificationEmailIfEligible', () => {
    it('returns if type unknown', async () => {
      await emailNotifService.sendGeneralNotificationEmailIfEligible({ type: 'unknown' });
      expect(sendGeneralNotificationEmail).not.toHaveBeenCalled();
    });

    it('returns if data missing', async () => {
      notificationModel.getUserEmailNotificationSettings.mockResolvedValue(null);
      await emailNotifService.sendGeneralNotificationEmailIfEligible({ type: 'follow' });
      expect(sendGeneralNotificationEmail).not.toHaveBeenCalled();
    });

    it('returns if preference disabled', async () => {
      notificationModel.getUserEmailNotificationSettings.mockResolvedValue({ ...mockRecipient, new_follower_email: false });
      notificationModel.getUserEmailIdentity.mockResolvedValue(mockSender);
      await emailNotifService.sendGeneralNotificationEmailIfEligible({ type: 'follow' });
      expect(sendGeneralNotificationEmail).not.toHaveBeenCalled();
    });

    it('sends email on success (follow)', async () => {
      notificationModel.getUserEmailNotificationSettings.mockResolvedValue({ ...mockRecipient, new_follower_email: true });
      notificationModel.getUserEmailIdentity.mockResolvedValue(mockSender);
      await emailNotifService.sendGeneralNotificationEmailIfEligible({ type: 'follow' });
      expect(sendGeneralNotificationEmail).toHaveBeenCalled();
    });

    it('handles display name fallback', async () => {
        notificationModel.getUserEmailNotificationSettings.mockResolvedValue({ email: 'e', username: 'user_x', new_follower_email: true });
        notificationModel.getUserEmailIdentity.mockResolvedValue({ username: 'actor_y' });
        await emailNotifService.sendGeneralNotificationEmailIfEligible({ type: 'follow' });
        expect(sendGeneralNotificationEmail).toHaveBeenCalledWith('e', expect.objectContaining({
            recipientName: 'user_x',
            actorName: 'actor_y'
        }));
    });

    it('handles complete missing names', async () => {
        notificationModel.getUserEmailNotificationSettings.mockResolvedValue({ email: 'e', new_follower_email: true });
        notificationModel.getUserEmailIdentity.mockResolvedValue({});
        await emailNotifService.sendGeneralNotificationEmailIfEligible({ type: 'follow' });
        expect(sendGeneralNotificationEmail).toHaveBeenCalledWith('e', expect.objectContaining({
            recipientName: 'there',
            actorName: 'there'
        }));
    });

    it('handles send failure gracefully', async () => {
        notificationModel.getUserEmailNotificationSettings.mockResolvedValue({ ...mockRecipient, new_follower_email: true });
        notificationModel.getUserEmailIdentity.mockResolvedValue(mockSender);
        sendGeneralNotificationEmail.mockRejectedValue(new Error('fail'));
        await emailNotifService.sendGeneralNotificationEmailIfEligible({ type: 'follow' });
    });

    it('handles catch block on outer error', async () => {
        notificationModel.getUserEmailNotificationSettings.mockRejectedValue(new Error('err'));
        await emailNotifService.sendGeneralNotificationEmailIfEligible({ type: 'follow' });
    });
  });
});
