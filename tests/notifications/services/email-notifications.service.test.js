describe('email-notifications.service', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('builds direct-message email URL as /messages/:conversationId', async () => {
    process.env.APP_URL = 'https://example.com';

    jest.doMock('../../../src/models/notification.model', () => ({
      getUserEmailNotificationSettings: jest.fn().mockResolvedValue({
        email: 'to@example.com',
        new_message_email: true,
        display_name: 'Bob',
      }),
      getUserEmailIdentity: jest.fn().mockResolvedValue({ display_name: 'Alice' }),
    }));

    jest.doMock('../../../src/utils/mailer', () => ({
      sendDirectMessageNotificationEmail: jest.fn().mockResolvedValue(undefined),
      sendGeneralNotificationEmail: jest.fn().mockResolvedValue(undefined),
    }));

    const service = require('../../../src/services/email-notifications.service');
    const mockedMailer = require('../../../src/utils/mailer');

    await service.sendDirectMessageEmailIfEligible({
      conversationId: 'c1',
      senderId: 's1',
      recipientId: 'r1',
    });

    expect(mockedMailer.sendDirectMessageNotificationEmail).toHaveBeenCalledWith(
      'to@example.com',
      expect.objectContaining({
        conversationUrl: 'https://example.com/messages/c1',
      })
    );
  });
});
