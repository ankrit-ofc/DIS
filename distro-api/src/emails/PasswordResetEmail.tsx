import React from 'react';
import { Html, Head, Body, Container, Section, Heading, Text, Hr } from '@react-email/components';

interface PasswordResetEmailProps {
  otp: string;
  email: string;
}

export function PasswordResetEmail({ otp, email }: PasswordResetEmailProps): React.ReactElement {
  return (
    <Html lang="en">
      <Head />
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Text style={logo}>DISTRO</Text>
          </Section>

          <Section style={content}>
            <Heading style={h1}>Reset your password</Heading>
            <Text style={subtext}>
              Your DISTRO password reset code is below. Use it to set a new password for {email}.
            </Text>

            <Section style={otpBox}>
              <Text style={otpText}>{otp}</Text>
            </Section>

            <Text style={validNote}>This code is valid for <strong>10 minutes</strong>.</Text>
            <Text style={warnNote}>If you didn't request this, ignore this email — your password will not change.</Text>
          </Section>

          <Hr style={hr} />
          <Text style={footer}>DISTRO Nepal Pvt Ltd — distronepal.com</Text>
        </Container>
      </Body>
    </Html>
  );
}

const body:     React.CSSProperties = { backgroundColor: '#F7F9FF', fontFamily: 'system-ui, sans-serif' };
const container:React.CSSProperties = { maxWidth: '560px', margin: '0 auto', padding: '24px 0' };
const header:   React.CSSProperties = { backgroundColor: '#1A4BDB', padding: '20px 32px', borderRadius: '8px 8px 0 0' };
const logo:     React.CSSProperties = { color: '#ffffff', fontWeight: 'bold', fontSize: '24px', margin: 0 };
const content:  React.CSSProperties = { backgroundColor: '#ffffff', padding: '32px', borderRadius: '0 0 8px 8px' };
const h1:       React.CSSProperties = { color: '#0D1120', fontSize: '22px', fontWeight: 'bold', margin: '0 0 8px' };
const subtext:  React.CSSProperties = { color: '#555555', fontSize: '14px', margin: '0 0 28px' };
const otpBox:   React.CSSProperties = { border: '2px solid #1A4BDB', borderRadius: '8px', padding: '20px 0', textAlign: 'center', margin: '0 0 24px' };
const otpText:  React.CSSProperties = { color: '#0D1120', fontSize: '32px', fontWeight: 'bold', letterSpacing: '8px', margin: 0, textAlign: 'center' };
const validNote:React.CSSProperties = { color: '#0D1120', fontSize: '14px', margin: '0 0 8px' };
const warnNote: React.CSSProperties = { color: '#EF4444', fontSize: '14px', fontWeight: 'bold', margin: 0 };
const hr:       React.CSSProperties = { borderColor: '#e5e7eb', margin: '24px 0 16px' };
const footer:   React.CSSProperties = { color: '#9ca3af', fontSize: '12px', textAlign: 'center', margin: 0 };
