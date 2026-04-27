import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const { name, email, message } = await req.json()

  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    return NextResponse.json({ error: 'All fields are required.' }, { status: 400 })
  }

  try {
    await resend.emails.send({
      from: 'Feedback <feedback@crashthearcade.com>',
      to: 'feedback@crashthearcade.com',
      replyTo: email,
      subject: `Feedback from ${name}`,
      text: `From: ${name} <${email}>\n\n${message}`,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Failed to send feedback email:', err)
    return NextResponse.json({ error: 'Failed to send. Please try again.' }, { status: 500 })
  }
}
