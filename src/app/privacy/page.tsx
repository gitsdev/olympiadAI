import type { Metadata } from "next";
import Link from "next/link";
import { MktNav } from "../MktNav";
import { Footer } from "../Footer";

export const metadata: Metadata = {
  title: "Privacy Policy | OlympiadIQ",
  description: "How OlympiadIQ collects, uses, and protects your personal information.",
  alternates: { canonical: "/privacy" },
};

const TOC = [
  { id: "infocollect", label: "1. What information do we collect?" },
  { id: "infouse", label: "2. How do we process your information?" },
  { id: "whoshare", label: "3. When and with whom do we share your personal information?" },
  { id: "ai", label: "4. Do we offer artificial intelligence-based products?" },
  { id: "inforetain", label: "5. How long do we keep your information?" },
  { id: "infosafe", label: "6. How do we keep your information safe?" },
  { id: "privacyrights", label: "7. What are your privacy rights?" },
  { id: "dnt", label: "8. Controls for Do-Not-Track features" },
  { id: "policyupdates", label: "9. Do we make updates to this notice?" },
  { id: "contact", label: "10. How can you contact us about this notice?" },
  { id: "request", label: "11. How can you review, update, or delete the data we collect from you?" },
];

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="font-bold tracking-tight mt-12 mb-3.5 scroll-mt-24"
      style={{ fontFamily: "var(--font-display)", fontSize: "clamp(19px, 3vw, 23px)", color: "var(--ink-900)" }}
    >
      {children}
    </h2>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="font-bold mt-6 mb-2"
      style={{ fontFamily: "var(--font-display)", fontSize: "16px", color: "var(--ink-900)" }}
    >
      {children}
    </h3>
  );
}

function P({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <p id={id} className="text-[14.5px] leading-[1.7] mb-4 scroll-mt-24" style={{ color: "var(--ink-700)" }}>
      {children}
    </p>
  );
}

function UL({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="mb-4 pl-5 flex flex-col gap-1.5" style={{ listStyleType: "disc" }}>
      {items.map((item, i) => (
        <li key={i} className="text-[14.5px] leading-[1.7]" style={{ color: "var(--ink-700)" }}>
          {item}
        </li>
      ))}
    </ul>
  );
}

function A({ href, children }: { href: string; children: React.ReactNode }) {
  const isInternal = href.startsWith("/");
  const className = "font-medium underline";
  const style = { color: "var(--brand)" };
  if (isInternal) {
    return <Link href={href} className={className} style={style}>{children}</Link>;
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className} style={style}>
      {children}
    </a>
  );
}

export default function PrivacyPage() {
  return (
    <div style={{ background: "var(--paper)" }}>
      <MktNav />

      <div className="max-w-[760px] mx-auto px-5 sm:px-8 py-12 pb-20">
        <h1
          className="font-black tracking-tight mb-2"
          style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px, 4.5vw, 38px)", letterSpacing: "-0.02em", color: "var(--ink-900)" }}
        >
          Privacy Policy
        </h1>
        <p className="text-[13.5px] mb-8" style={{ color: "var(--fg-muted)" }}>Last updated August 26, 2026</p>

        <P>
          This Privacy Notice for Guild IT Solutions (doing business as <strong>OlympiadIQ</strong>) (&ldquo;we&rdquo;,
          &ldquo;us&rdquo;, or &ldquo;our&rdquo;) describes how and why we might access, collect, store, use, and/or
          share (&ldquo;process&rdquo;) your personal information when you use our services (&ldquo;Services&rdquo;),
          including when you:
        </P>
        <UL
          items={[
            <>Visit our website at <A href="https://www.olympiadiq.in">https://www.olympiadiq.in</A>, or any website of ours that links to this Privacy Notice</>,
            <>Engage with us in other related ways, including any marketing or events</>,
          ]}
        />
        <P>
          <strong>Questions or concerns?</strong> Reading this Privacy Notice will help you understand your privacy
          rights and choices. We are responsible for making decisions about how your personal information is
          processed. If you do not agree with our policies and practices, please do not use our Services. If you
          still have any questions or concerns, please contact us at <A href="/settings">your account settings</A>.
        </P>

        <H2 id="toc-summary">Summary of key points</H2>
        <P>
          <em>This summary provides key points from our Privacy Notice, but you can find out more details about any
          of these topics by clicking the link following each key point or by using the table of contents below to
          find the section you are looking for.</em>
        </P>
        <UL
          items={[
            <><strong>What personal information do we process?</strong> When you visit, use, or navigate our Services, we may process personal information depending on how you interact with us and the Services, the choices you make, and the products and features you use. Learn more about <A href="#infocollect">personal information you disclose to us</A>.</>,
            <><strong>Do we process any sensitive personal information?</strong> Some information may be considered &ldquo;special&rdquo; or &ldquo;sensitive&rdquo; in certain jurisdictions — for example, racial or ethnic origins, sexual orientation, and religious beliefs. We do not process sensitive personal information.</>,
            <><strong>Do we collect any information from third parties?</strong> We do not collect any information from third parties.</>,
            <><strong>How do we process your information?</strong> We process your information to provide, improve, and administer our Services, communicate with you, for security and fraud prevention, and to comply with law. We may also process your information for other purposes with your consent. Learn more about <A href="#infouse">how we process your information</A>.</>,
            <><strong>In what situations and with which parties do we share personal information?</strong> We may share information in specific situations and with specific third parties. Learn more about <A href="#whoshare">when and with whom we share your personal information</A>.</>,
            <><strong>How do we keep your information safe?</strong> We have adequate organisational and technical processes and procedures in place to protect your personal information. However, no electronic transmission or storage technology can be guaranteed 100% secure. Learn more about <A href="#infosafe">how we keep your information safe</A>.</>,
            <><strong>What are your rights?</strong> Depending on where you are located geographically, applicable privacy law may give you certain rights regarding your personal information. Learn more about <A href="#privacyrights">your privacy rights</A>.</>,
            <><strong>How do you exercise your rights?</strong> The easiest way is by visiting <A href="/settings">your account settings</A>, or by contacting us. We will consider and act upon any request in accordance with applicable data protection laws.</>,
          ]}
        />

        <H2 id="toc">Table of contents</H2>
        <UL items={TOC.map((t) => <A key={t.id} href={`#${t.id}`}>{t.label}</A>)} />

        <H2 id="infocollect">1. What information do we collect?</H2>
        <H3>Personal information you disclose to us</H3>
        <P><em><strong>In short:</strong> We collect personal information that you provide to us.</em></P>
        <P>
          We collect personal information that you voluntarily provide to us when you register on the Services,
          express an interest in obtaining information about us or our products and Services, when you participate
          in activities on the Services, or otherwise when you contact us.
        </P>
        <P>
          <strong>Personal information provided by you.</strong> The personal information that we collect depends on
          the context of your interactions with us and the Services, the choices you make, and the products and
          features you use. The personal information we collect may include the following:
        </P>
        <UL items={["Names", "Phone numbers", "Email addresses", "Mailing addresses", "Usernames", "Passwords", "Contact preferences", "Billing addresses", "Debit/credit card numbers"]} />
        <P><strong>Sensitive information.</strong> We do not process sensitive information.</P>
        <P>
          All personal information that you provide to us must be true, complete, and accurate, and you must notify
          us of any changes to such personal information.
        </P>
        <H3>Google API</H3>
        <P>
          Our use of information received from Google APIs will adhere to the{" "}
          <A href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</A>,
          including the <A href="https://developers.google.com/terms/api-services-user-data-policy#limited-use">Limited Use requirements</A>.
        </P>

        <H2 id="infouse">2. How do we process your information?</H2>
        <P>
          <em><strong>In short:</strong> We process your information to provide, improve, and administer our
          Services, communicate with you, for security and fraud prevention, and to comply with law. We may also
          process your information for other purposes with your consent.</em>
        </P>
        <P>We process your personal information for a variety of reasons, depending on how you interact with our Services, including:</P>
        <UL
          items={[
            <><strong>To facilitate account creation and authentication and otherwise manage user accounts.</strong> We may process your information so you can create and log in to your account, as well as keep your account in working order.</>,
            <><strong>To respond to user inquiries / offer support to users.</strong> We may process your information to respond to your inquiries and solve any potential issues you might have with the requested service.</>,
            <><strong>To send administrative information to you.</strong> We may process your information to send you details about our products and services, changes to our terms and policies, and other similar information.</>,
            <><strong>To request feedback.</strong> We may process your information when necessary to request feedback and to contact you about your use of our Services.</>,
            <><strong>To send you marketing and promotional communications.</strong> We may process the personal information you send to us for our marketing purposes, if this is in accordance with your marketing preferences. You can opt out at any time — see <A href="#privacyrights">What are your privacy rights?</A> below.</>,
            <><strong>To protect our Services.</strong> We may process your information as part of our efforts to keep our Services safe and secure, including fraud monitoring and prevention.</>,
            <><strong>To administer prize draws and competitions.</strong> We may process your information to administer prize draws and competitions.</>,
            <><strong>To evaluate and improve our Services, products, marketing, and your experience.</strong> We may process your information when we believe it is necessary to identify usage trends, determine the effectiveness of our promotional campaigns, and to evaluate and improve our Services, products, marketing, and your experience.</>,
            <><strong>To identify usage trends.</strong> We may process information about how you use our Services to better understand how they are being used so we can improve them.</>,
            <><strong>To determine the effectiveness of our marketing and promotional campaigns.</strong> We may process your information to better understand how to provide marketing and promotional campaigns that are most relevant to you.</>,
          ]}
        />

        <H2 id="whoshare">3. When and with whom do we share your personal information?</H2>
        <P>
          <em><strong>In short:</strong> We may share information in specific situations described in this section
          and/or with the following third parties.</em>
        </P>
        <P>We may need to share your personal information in the following situations:</P>
        <UL
          items={[
            <><strong>Business transfers.</strong> We may share or transfer your information in connection with, or during negotiations of, any merger, sale of company assets, financing, or acquisition of all or a portion of our business to another company.</>,
          ]}
        />

        <H2 id="ai">4. Do we offer artificial intelligence-based products?</H2>
        <P>
          <em><strong>In short:</strong> We offer products, features, or tools powered by artificial intelligence,
          machine learning, or similar technologies.</em>
        </P>
        <P>
          As part of our Services, we offer products, features, or tools powered by artificial intelligence, machine
          learning, or similar technologies (collectively, &ldquo;AI Products&rdquo;). These tools are designed to
          enhance your experience and provide you with innovative solutions. The terms in this Privacy Notice govern
          your use of the AI Products within our Services.
        </P>
        <H3>Use of AI technologies</H3>
        <P>
          We provide the AI Products through third-party service providers (&ldquo;AI Service Providers&rdquo;),
          including Google (Gemini) and Groq. As outlined in this Privacy Notice, your input, output, and personal
          information will be shared with and processed by these AI Service Providers to enable your use of our AI
          Products for the purposes outlined in <A href="#whoshare">When and with whom do we share your personal information?</A> You
          must not use the AI Products in any way that violates the terms or policies of any AI Service Provider.
        </P>
        <H3>Our AI products</H3>
        <P>Our AI Products are designed for the following functions:</P>
        <UL items={["AI applications — including an AI tutor, automated question and study-plan generation, and adaptive assessment"]} />
        <H3>How we process your data using AI</H3>
        <P>
          All personal information processed using our AI Products is handled in line with this Privacy Notice and
          our agreements with third parties. This is intended to safeguard your personal information throughout the
          process.
        </P>

        <H2 id="inforetain">5. How long do we keep your information?</H2>
        <P>
          <em><strong>In short:</strong> We keep your information for as long as necessary to fulfil the purposes
          outlined in this Privacy Notice, unless otherwise required by law.</em>
        </P>
        <P>
          We will only keep your personal information for as long as it is necessary for the purposes set out in
          this Privacy Notice, unless a longer retention period is required or permitted by law (such as tax,
          accounting, or other legal requirements). No purpose in this notice will require us to keep your personal
          information for longer than the period of time in which you have an account with us.
        </P>
        <P>
          When we have no ongoing legitimate business need to process your personal information, we will either
          delete or anonymise it, or, if this is not possible (for example, because your personal information has
          been stored in backup archives), then we will securely store your personal information and isolate it
          from any further processing until deletion is possible.
        </P>

        <H2 id="infosafe">6. How do we keep your information safe?</H2>
        <P>
          <em><strong>In short:</strong> We aim to protect your personal information through a system of
          organisational and technical security measures.</em>
        </P>
        <P>
          We have implemented appropriate and reasonable technical and organisational security measures designed to
          protect the security of any personal information we process. However, despite our safeguards and efforts
          to secure your information, no electronic transmission over the internet or information storage technology
          can be guaranteed to be 100% secure, so we cannot promise or guarantee that hackers, cybercriminals, or
          other unauthorised third parties will not be able to defeat our security and improperly collect, access,
          steal, or modify your information. Although we will do our best to protect your personal information,
          transmission of personal information to and from our Services is at your own risk. You should only access
          the Services within a secure environment.
        </P>

        <H2 id="privacyrights">7. What are your privacy rights?</H2>
        <P>
          <em><strong>In short:</strong> You may review, change, or terminate your account at any time, depending on
          your country, province, or state of residence.</em>
        </P>
        <P id="withdrawconsent">
          <strong>Withdrawing your consent.</strong> If we are relying on your consent to process your personal
          information, which may be express and/or implied consent depending on applicable law, you have the right
          to withdraw your consent at any time. You can withdraw your consent at any time by contacting us using the
          details in <A href="#contact">How can you contact us about this notice?</A> below.
        </P>
        <P>
          However, please note that this will not affect the lawfulness of the processing before its withdrawal,
          nor will it affect the processing of your personal information conducted in reliance on lawful processing
          grounds other than consent, where applicable law allows.
        </P>
        <P>
          <strong>Opting out of marketing and promotional communications.</strong> You can unsubscribe from our
          marketing and promotional communications at any time by clicking the unsubscribe link in the emails we
          send, or by contacting us using the details in <A href="#contact">How can you contact us about this notice?</A> below.
          You will then be removed from the marketing lists — however, we may still communicate with you for
          service-related messages necessary for the administration and use of your account, to respond to service
          requests, or for other non-marketing purposes.
        </P>
        <H3>Account information</H3>
        <P>If you would like to review or change the information in your account, or terminate your account, you can:</P>
        <UL items={[<>Log in to <A href="/settings">your account settings</A> and update your account.</>]} />
        <P>
          Upon your request to terminate your account, we will deactivate or delete your account and information
          from our active databases. However, we may retain some information in our files to prevent fraud,
          troubleshoot problems, assist with any investigations, enforce our legal terms, and/or comply with
          applicable legal requirements.
        </P>
        <P>If you have questions or comments about your privacy rights, you may reach us through <A href="/settings">your account settings</A>.</P>

        <H2 id="dnt">8. Controls for Do-Not-Track features</H2>
        <P>
          Most web browsers and some mobile operating systems and mobile applications include a Do-Not-Track
          (&ldquo;DNT&rdquo;) feature or setting you can activate to signal your privacy preference not to have data
          about your online browsing activities monitored and collected. At this stage, no uniform technology
          standard for recognising and implementing DNT signals has been finalised. As such, we do not currently
          respond to DNT browser signals or any other mechanism that automatically communicates your choice not to
          be tracked online. If a standard for online tracking is adopted that we must follow in the future, we will
          inform you about that practice in a revised version of this Privacy Notice.
        </P>

        <H2 id="policyupdates">9. Do we make updates to this notice?</H2>
        <P><em><strong>In short:</strong> Yes, we will update this notice as necessary to stay compliant with relevant laws.</em></P>
        <P>
          We may update this Privacy Notice from time to time. The updated version will be indicated by an updated
          &ldquo;Last updated&rdquo; date at the top of this Privacy Notice. If we make material changes to this
          Privacy Notice, we may notify you either by prominently posting a notice of such changes or by directly
          sending you a notification. We encourage you to review this Privacy Notice frequently to be informed of
          how we are protecting your information.
        </P>

        <H2 id="contact">10. How can you contact us about this notice?</H2>
        <P>
          If you have questions or comments about this notice, you may email us at{" "}
          <A href="mailto:support@olympiadiq.in">support@olympiadiq.in</A>, or contact us by post at:
        </P>
        <P>
          Guild IT Solutions<br />
          Kazi Nazrul Islam Ave<br />
          Kolkata, West Bengal 700059<br />
          India
        </P>

        <H2 id="request">11. How can you review, update, or delete the data we collect from you?</H2>
        <P>
          Based on the applicable laws of your country, you may have the right to request access to the personal
          information we collect from you, details about how we have processed it, correct inaccuracies, or delete
          your personal information. You may also have the right to withdraw your consent to our processing of your
          personal information. These rights may be limited in some circumstances by applicable law. To request to
          review, update, or delete your personal information, please visit <A href="/settings">your account settings</A>.
        </P>
      </div>

      <Footer />
    </div>
  );
}
