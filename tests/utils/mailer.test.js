const nodemailer = require('nodemailer');

jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue(true),
  }),
}));

jest.mock('../../src/config/env', () => ({
  GMAIL_USER: 'test@gmail.com',
  GMAIL_APP_PASSWORD: 'testpassword',
  EMAIL_FROM: 'noreply@test.local',
  APP_URL: 'http://localhost:3000',
}));

describe('Mailer Utility', () => {
  let mailer;
  let mockTransporter;

  beforeEach(() => {
    jest.clearAllMocks();
    mockTransporter = nodemailer.createTransport();
    mailer = require('../../src/utils/mailer');
  });

  describe('sendVerificationEmail', () => {
    it('sends a verification email', async () => {
      await mailer.sendVerificationEmail('user@test.com', { displayName: 'John', token: '123' });
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(expect.objectContaining({
        to: 'user@test.com',
        subject: 'Verify your Rythmify account',
        html: expect.stringContaining('Verify your email'),
        from: 'noreply@test.local'
      }));
    });
  });

  describe('sendResendVerificationEmail', () => {
    it('sends a resend verification email', async () => {
      await mailer.sendResendVerificationEmail('user@test.com', { displayName: 'John', token: '123' });
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(expect.objectContaining({
        to: 'user@test.com',
        subject: 'New verification link — Rythmify',
        html: expect.stringContaining('New verification link'),
      }));
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('sends a password reset email', async () => {
      await mailer.sendPasswordResetEmail('user@test.com', { displayName: 'John', token: '123' });
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(expect.objectContaining({
        to: 'user@test.com',
        subject: 'Reset your Rythmify password',
        html: expect.stringContaining('Reset your password'),
      }));
    });
  });

  describe('sendEmailChangeEmail', () => {
    it('sends an email change verification', async () => {
      await mailer.sendEmailChangeEmail('user@test.com', { displayName: 'John', token: '123' });
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(expect.objectContaining({
        to: 'user@test.com',
        subject: 'Confirm your new Rythmify email address',
        html: expect.stringContaining('Confirm your new email'),
      }));
    });
  });

  describe('sendDirectMessageNotificationEmail', () => {
    it('sends a DM notification email with threading headers', async () => {
      await mailer.sendDirectMessageNotificationEmail('user@test.com', {
        recipientName: 'John',
        senderName: 'Jane',
        conversationUrl: 'http://test/chat',
        threadKey: 'chat-1'
      });
      
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(expect.objectContaining({
        to: 'user@test.com',
        subject: 'New message from Jane on Rythmify',
        messageId: expect.stringMatching(/<msg-chat-1-/),
        inReplyTo: '<thread-chat-1@test.local>',
        references: '<thread-chat-1@test.local>'
      }));
    });
    
    it('handles missing threadKey safely', async () => {
      await mailer.sendDirectMessageNotificationEmail('user@test.com', {
        recipientName: 'John',
        senderName: 'Jane',
        conversationUrl: 'http://test/chat',
      });
      expect(mockTransporter.sendMail).toHaveBeenCalled();
    });
  });

  describe('sendGeneralNotificationEmail', () => {
    it('sends follow notification', async () => {
      await mailer.sendGeneralNotificationEmail('user@test.com', {
        recipientName: 'John',
        actorName: 'Jane',
        type: 'follow',
        notificationsUrl: 'http://test/notifs',
        threadKey: 'notif-1'
      });
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(expect.objectContaining({
        subject: 'Jane started following you on Rythmify'
      }));
    });

    it('sends like notification', async () => {
      await mailer.sendGeneralNotificationEmail('user@test.com', {
        recipientName: 'John',
        actorName: 'Jane',
        type: 'like',
        notificationsUrl: 'http://test/notifs',
        threadKey: 'notif-1'
      });
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(expect.objectContaining({
        subject: 'Jane liked your post on Rythmify'
      }));
    });
    
    it('sends fallback notification for unknown type', async () => {
      await mailer.sendGeneralNotificationEmail('user@test.com', {
        recipientName: 'John',
        actorName: 'Jane',
        type: 'unknown_type',
        notificationsUrl: 'http://test/notifs',
        threadKey: 'notif-1'
      });
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(expect.objectContaining({
        subject: 'New activity on your Rythmify account'
      }));
    });
  });

  describe('getMessageIdDomain edge cases', () => {
    it('falls back if email from is missing domain', async () => {
      // Just modify the env object directly without resetting modules
      const originalEmailFrom = require('../../src/config/env').EMAIL_FROM;
      require('../../src/config/env').EMAIL_FROM = 'invalid-email';
      
      await mailer.sendDirectMessageNotificationEmail('user@test.com', {
        recipientName: 'John',
        senderName: 'Jane',
        conversationUrl: 'http://test/chat',
        threadKey: 'chat-1'
      });
      
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(expect.objectContaining({
        inReplyTo: '<thread-chat-1@rythmify.local>',
      }));
      
      require('../../src/config/env').EMAIL_FROM = originalEmailFrom;
    });
  });
});
