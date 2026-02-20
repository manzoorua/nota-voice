import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const Privacy = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">Privacy Policy</h1>
            <p className="text-muted-foreground">
              Last updated: {new Date().toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
          </div>

          <div className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Information We Collect</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none">
                <p>
                  At NotaVoice, we collect only the information necessary to provide our voice-to-text 
                  transcription service:
                </p>
                <ul>
                  <li><strong>Audio Data:</strong> We temporarily process your voice recordings to generate transcriptions</li>
                  <li><strong>Account Information:</strong> Email address and name for account creation</li>
                  <li><strong>Usage Data:</strong> Basic analytics to improve our service</li>
                  <li><strong>Device Information:</strong> Browser type and device information for compatibility</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>How We Use Your Information</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none">
                <p>Your information is used solely to:</p>
                <ul>
                  <li>Provide accurate voice-to-text transcription services</li>
                  <li>Maintain and improve our AI models</li>
                  <li>Send important service notifications</li>
                  <li>Provide customer support when requested</li>
                </ul>
                <p>
                  <strong>We never sell, rent, or share your personal data with third parties for marketing purposes.</strong>
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Data Security & Storage</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none">
                <h4>Audio Processing</h4>
                <p>
                  Your audio recordings are processed in real-time and <strong>not permanently stored</strong> 
                  on our servers. Audio data is deleted immediately after transcription is complete.
                </p>
                
                <h4>Text Storage</h4>
                <p>
                  Your transcribed notes are securely encrypted and stored in your personal account. 
                  Only you have access to your notes.
                </p>
                
                <h4>Security Measures</h4>
                <ul>
                  <li>All data transmission uses industry-standard SSL encryption</li>
                  <li>Our servers are hosted in secure, certified data centers</li>
                  <li>Regular security audits and monitoring</li>
                  <li>Access controls and authentication protocols</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Your Rights & Control</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none">
                <p>You have complete control over your data:</p>
                <ul>
                  <li><strong>Access:</strong> View all data we have about you</li>
                  <li><strong>Portability:</strong> Export your notes at any time</li>
                  <li><strong>Deletion:</strong> Delete your account and all associated data</li>
                  <li><strong>Correction:</strong> Update or correct your information</li>
                </ul>
                <p>
                  To exercise any of these rights, contact us at privacy@notavoice.ai
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cookies & Tracking</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none">
                <p>We use minimal cookies for:</p>
                <ul>
                  <li>Authentication and session management</li>
                  <li>Remembering your preferences</li>
                  <li>Basic analytics (anonymized)</li>
                </ul>
                <p>
                  We do not use tracking pixels, advertising cookies, or invasive analytics. 
                  You can disable cookies in your browser settings if preferred.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Third-Party Services</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none">
                <p>We work with trusted partners for specific services:</p>
                <ul>
                  <li><strong>OpenAI:</strong> AI transcription processing (data not retained by OpenAI)</li>
                  <li><strong>Supabase:</strong> Secure database hosting</li>
                  <li><strong>Cloudflare:</strong> Content delivery and security</li>
                </ul>
                <p>
                  All partners are bound by strict data processing agreements and cannot 
                  use your data for their own purposes.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Children's Privacy</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none">
                <p>
                  NotaVoice is not intended for children under 13. We do not knowingly collect 
                  personal information from children under 13. If we become aware that we have 
                  collected such information, we will delete it immediately.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>International Users</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none">
                <p>
                  NotaVoice is available globally. If you're using our service from outside 
                  the United States, please note that your data may be transferred to and 
                  processed in the US, where our servers are located. We ensure the same 
                  level of protection regardless of location.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Changes to This Policy</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none">
                <p>
                  We may update this privacy policy from time to time. We will notify you of 
                  any material changes by email or through our service. The "last updated" 
                  date at the top of this policy indicates when it was most recently revised.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Contact Us</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none">
                <p>
                  If you have any questions about this privacy policy or our data practices, 
                  please contact us:
                </p>
                <ul>
                  <li>Email: privacy@notavoice.ai</li>
                  <li>Support: support@notavoice.ai</li>
                  <li>Website: notavoice.ai/help</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Privacy;