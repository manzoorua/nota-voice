import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const Terms = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">Terms of Service</h1>
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
                <CardTitle>1. Acceptance of Terms</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none">
                <p>
                  By accessing or using NotaVoice ("the Service"), you agree to be bound by these 
                  Terms of Service ("Terms"). If you do not agree to these Terms, please do not 
                  use the Service.
                </p>
                <p>
                  These Terms constitute a legally binding agreement between you and NotaVoice. 
                  We may update these Terms from time to time, and your continued use of the Service 
                  constitutes acceptance of any changes.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>2. Description of Service</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none">
                <p>
                  NotaVoice is an AI-powered voice-to-text transcription service that converts 
                  spoken words into written text. The Service includes:
                </p>
                <ul>
                  <li>Real-time voice transcription</li>
                  <li>AI-enhanced text formatting and editing</li>
                  <li>Note organization and management</li>
                  <li>Export and sharing capabilities</li>
                </ul>
                <p>
                  We reserve the right to modify, suspend, or discontinue any aspect of the Service 
                  at any time with reasonable notice.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>3. User Accounts and Registration</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none">
                <p>
                  To access certain features, you must create an account. You agree to:
                </p>
                <ul>
                  <li>Provide accurate and complete information</li>
                  <li>Maintain the security of your account credentials</li>
                  <li>Promptly update any changes to your information</li>
                  <li>Accept responsibility for all activities under your account</li>
                </ul>
                <p>
                  You must be at least 13 years old to create an account. Users under 18 must 
                  have parental consent.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>4. Acceptable Use Policy</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none">
                <p>You agree not to use the Service to:</p>
                <ul>
                  <li>Upload, transcribe, or process illegal, harmful, or offensive content</li>
                  <li>Violate any applicable laws or regulations</li>
                  <li>Infringe on intellectual property rights of others</li>
                  <li>Attempt to reverse engineer or hack the Service</li>
                  <li>Use automated tools to access the Service without permission</li>
                  <li>Share account credentials with others</li>
                </ul>
                <p>
                  We reserve the right to suspend or terminate accounts that violate this policy.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>5. Privacy and Data Protection</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none">
                <p>
                  Your privacy is important to us. Please review our Privacy Policy to understand 
                  how we collect, use, and protect your information.
                </p>
                <p>Key points:</p>
                <ul>
                  <li>Audio recordings are not permanently stored</li>
                  <li>Transcribed text belongs to you</li>
                  <li>We use industry-standard security measures</li>
                  <li>You can delete your data at any time</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>6. Intellectual Property Rights</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none">
                <h4>Your Content</h4>
                <p>
                  You retain all rights to the content you create using our Service. However, 
                  you grant us a limited license to process and store your content as necessary 
                  to provide the Service.
                </p>
                
                <h4>Our Service</h4>
                <p>
                  The NotaVoice platform, including its design, functionality, and underlying 
                  technology, is protected by intellectual property laws. You may not copy, 
                  modify, or redistribute our technology without permission.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>7. Billing and Payments</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none">
                <h4>Free Tier</h4>
                <p>
                  We offer a free tier with limitations on usage (number of notes, recording length).
                </p>
                
                <h4>Premium Subscriptions</h4>
                <p>
                  Premium plans are billed in advance and are non-refundable except as required by law. 
                  You can cancel your subscription at any time, and it will remain active until 
                  the end of your billing period.
                </p>
                
                <h4>Payment Processing</h4>
                <p>
                  Payments are processed securely through third-party payment processors. 
                  We do not store your payment information.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>8. Service Availability and Performance</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none">
                <p>
                  While we strive for high availability, we cannot guarantee uninterrupted service. 
                  The Service may be temporarily unavailable due to:
                </p>
                <ul>
                  <li>Scheduled maintenance</li>
                  <li>Technical issues or outages</li>
                  <li>Third-party service dependencies</li>
                  <li>Force majeure events</li>
                </ul>
                <p>
                  We are not liable for any losses resulting from service interruptions.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>9. Limitation of Liability</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none">
                <p>
                  To the maximum extent permitted by law, NotaVoice shall not be liable for any 
                  indirect, incidental, special, consequential, or punitive damages, including 
                  but not limited to loss of profits, data, or business opportunities.
                </p>
                <p>
                  Our total liability for any claims arising from your use of the Service shall 
                  not exceed the amount you paid us in the 12 months preceding the claim.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>10. Indemnification</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none">
                <p>
                  You agree to indemnify and hold harmless NotaVoice from any claims, damages, 
                  or expenses arising from your use of the Service, violation of these Terms, 
                  or infringement of any third-party rights.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>11. Termination</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none">
                <p>
                  Either party may terminate this agreement at any time. Upon termination:
                </p>
                <ul>
                  <li>Your access to the Service will be discontinued</li>
                  <li>You may export your data before termination</li>
                  <li>We may delete your data after a reasonable period</li>
                  <li>These Terms will continue to apply to past use of the Service</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>12. Governing Law and Disputes</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none">
                <p>
                  These Terms are governed by the laws of [Jurisdiction]. Any disputes will be 
                  resolved through binding arbitration, except for small claims court matters.
                </p>
                <p>
                  Before initiating formal proceedings, both parties agree to attempt resolution 
                  through good faith negotiation for at least 30 days.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>13. Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none">
                <p>
                  If you have questions about these Terms, please contact us:
                </p>
                <ul>
                  <li>Email: legal@notavoice.ai</li>
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

export default Terms;