// Email service interface for sending user credentials
// This is a stub implementation that can be replaced with real SMTP

export interface EmailData {
  to: string
  subject: string
  html: string
  text?: string
}

export interface UserCredentials {
  email: string
  password: string
  name?: string
  companyName: string
  projectName: string
  role: string
}

// Stub email service - replace with real SMTP provider
export class EmailService {
  static async sendUserCredentials(credentials: UserCredentials): Promise<boolean> {
    try {
      // In a real implementation, this would send an actual email
      // For now, we'll just log the credentials and return true
      console.log('📧 EMAIL SENT (STUB):', {
        to: credentials.email,
        subject: `Welcome to ${credentials.companyName} - Your Login Credentials`,
        credentials: {
          email: credentials.email,
          password: credentials.password,
          name: credentials.name,
          company: credentials.companyName,
          project: credentials.projectName,
          role: credentials.role
        }
      })

      // Simulate email sending delay
      await new Promise(resolve => setTimeout(resolve, 1000))

      return true
    } catch (error) {
      console.error('Failed to send email:', error)
      return false
    }
  }

  static generateEmailTemplate(credentials: UserCredentials): { html: string; text: string } {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Welcome to ${credentials.companyName}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #3b82f6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
          .credentials { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6; }
          .credential-item { margin: 10px 0; }
          .label { font-weight: bold; color: #374151; }
          .value { font-family: monospace; background: #f1f5f9; padding: 4px 8px; border-radius: 4px; }
          .warning { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 8px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to ${credentials.companyName}!</h1>
            <p>Your account has been created successfully</p>
          </div>
          <div class="content">
            <p>Hello ${credentials.name || 'there'},</p>
            <p>Your account has been created for the <strong>${credentials.projectName}</strong> project at ${credentials.companyName}.</p>
            
            <div class="credentials">
              <h3>Your Login Credentials:</h3>
              <div class="credential-item">
                <span class="label">Email:</span>
                <span class="value">${credentials.email}</span>
              </div>
              <div class="credential-item">
                <span class="label">Password:</span>
                <span class="value">${credentials.password}</span>
              </div>
              <div class="credential-item">
                <span class="label">Role:</span>
                <span class="value">${credentials.role}</span>
              </div>
            </div>

            <div class="warning">
              <strong>⚠️ Important Security Notice:</strong>
              <ul>
                <li>Please change your password after your first login</li>
                <li>Keep your credentials secure and don't share them</li>
                <li>Contact your administrator if you have any questions</li>
              </ul>
            </div>

            <p>You can now log in to the expense management system and start tracking your expenses for the ${credentials.projectName} project.</p>
            
            <p>If you have any questions, please contact your project administrator.</p>
          </div>
          <div class="footer">
            <p>This is an automated message from ${credentials.companyName} Expense Management System</p>
          </div>
        </div>
      </body>
      </html>
    `

    const text = `
Welcome to ${credentials.companyName}!

Hello ${credentials.name || 'there'},

Your account has been created for the ${credentials.projectName} project at ${credentials.companyName}.

Your Login Credentials:
- Email: ${credentials.email}
- Password: ${credentials.password}
- Role: ${credentials.role}

IMPORTANT SECURITY NOTICE:
- Please change your password after your first login
- Keep your credentials secure and don't share them
- Contact your administrator if you have any questions

You can now log in to the expense management system and start tracking your expenses for the ${credentials.projectName} project.

If you have any questions, please contact your project administrator.

This is an automated message from ${credentials.companyName} Expense Management System
    `

    return { html, text }
  }
}

