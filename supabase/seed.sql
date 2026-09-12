insert into public.levels (name, slug, "order")
values
  ('Level 1', 'level-1', 1),
  ('Level 2', 'level-2', 2),
  ('Level 3', 'level-3', 3)
on conflict (slug) do nothing;

insert into public.standards (code, title, body, category, "order")
values
  (
    'INTRO',
    'I. Introduction',
    'The CFA Institute Code of Ethics and Standards of Professional Conduct are the foundation of this course. One idea per screen: what the Code requires, why it exists, and how a charterholder is expected to act.',
    'introduction',
    0
  ),
  (
    'CON-1',
    'Professionalism',
    'Professionalism is the duty to know the law, remain independent, represent facts honestly, and avoid misconduct that reflects poorly on the profession.',
    'concept',
    1
  ),
  (
    'CON-2',
    'Integrity of Capital Markets',
    'Capital markets function only when material nonpublic information is protected and prices are not manipulated.',
    'concept',
    2
  ),
  (
    'CON-3',
    'Duties to Clients',
    'Clients come first: loyalty, prudence, care, fair dealing, suitability, honest performance presentation, and confidentiality.',
    'concept',
    3
  ),
  (
    'CON-4',
    'Duties to Employers',
    'Loyalty to the firm, disclosure of extra compensation, and responsible supervision protect clients and the employer together.',
    'concept',
    4
  ),
  (
    'CON-5',
    'Investment Analysis & Recommendations',
    'Analysis must rest on diligence and a reasonable basis, be communicated clearly, and be retained as a record.',
    'concept',
    5
  ),
  (
    'CON-6',
    'Conflicts of Interest',
    'Conflicts are disclosed, client and employer transactions take priority, and referral fees are revealed in full.',
    'concept',
    6
  ),
  (
    'CON-7',
    'Responsibilities as a CFA Member/Candidate',
    'Conduct in CFA Institute programs and references to the designation must protect the integrity of the charter.',
    'concept',
    7
  ),
  (
    'I',
    'Standard I: Professionalism',
    'Know the law, stay independent, do not misrepresent, and do not engage in professional misconduct.',
    'standard',
    10
  ),
  (
    'I(A)',
    'I(A) Knowledge of the Law',
    'Understand and comply with all applicable laws, rules, and regulations. When they conflict, follow the stricter requirement. Do not participate in or assist violations; dissociate when necessary.',
    'standard',
    11
  ),
  (
    'I(B)',
    'I(B) Independence and Objectivity',
    'Use reasonable care and judgment to achieve and maintain independence and objectivity. Do not offer, solicit, or accept gifts or compensation that reasonably could be expected to compromise that independence.',
    'standard',
    12
  ),
  (
    'I(C)',
    'I(C) Misrepresentation',
    'Do not make any untrue statement relating to investment analysis, recommendations, actions, or other professional activities. Do not guarantee investment performance.',
    'standard',
    13
  ),
  (
    'I(D)',
    'I(D) Misconduct',
    'Do not engage in any professional conduct involving dishonesty, fraud, or deceit, or commit any act that reflects adversely on professional reputation, integrity, or competence.',
    'standard',
    14
  ),
  (
    'II',
    'Standard II: Integrity of Capital Markets',
    'Protect market integrity: do not trade on material nonpublic information and do not manipulate markets.',
    'standard',
    20
  ),
  (
    'II(A)',
    'II(A) Material Nonpublic Information',
    'Do not act or cause others to act on material nonpublic information that could affect the value of an investment. Adopt information barriers and a need-to-know culture.',
    'standard',
    21
  ),
  (
    'II(B)',
    'II(B) Market Manipulation',
    'Do not engage in practices that distort prices or artificially inflate trading volume with the intent to mislead market participants.',
    'standard',
    22
  ),
  (
    'III',
    'Standard III: Duties to Clients',
    'Place clients first through loyalty, fair dealing, suitability, honest performance reporting, and confidentiality.',
    'standard',
    30
  ),
  (
    'III(A)',
    'III(A) Loyalty, Prudence, and Care',
    'Act for the benefit of clients and place their interests before your own or your employer''s. Use reasonable care and prudent judgment.',
    'standard',
    31
  ),
  (
    'III(B)',
    'III(B) Fair Dealing',
    'Deal fairly and objectively with all clients when providing investment analysis, making recommendations, taking action, or engaging in other professional activities.',
    'standard',
    32
  ),
  (
    'III(C)',
    'III(C) Suitability',
    'When in an advisory relationship, make a reasonable inquiry into the client''s circumstances and judge the suitability of investments in the context of the whole portfolio.',
    'standard',
    33
  ),
  (
    'III(D)',
    'III(D) Performance Presentation',
    'When communicating investment performance, make reasonable efforts to ensure that it is fair, accurate, and complete.',
    'standard',
    34
  ),
  (
    'III(E)',
    'III(E) Preservation of Confidentiality',
    'Keep information about current, former, and prospective clients confidential unless the information concerns illegal activities, disclosure is required by law, or the client permits disclosure.',
    'standard',
    35
  ),
  (
    'IV',
    'Standard IV: Duties to Employers',
    'Be loyal to the employer, disclose additional compensation, and supervise those who report to you.',
    'standard',
    40
  ),
  (
    'IV(A)',
    'IV(A) Loyalty',
    'Act for the benefit of the employer. Do not deprive the firm of your skills, divulge confidential information, or otherwise cause harm. Independent practice and leaving a firm have specific disclosure duties.',
    'standard',
    41
  ),
  (
    'IV(B)',
    'IV(B) Additional Compensation Arrangements',
    'Do not accept gifts, benefits, compensation, or consideration that competes with or might reasonably be expected to create a conflict of interest with the employer unless you obtain written consent.',
    'standard',
    42
  ),
  (
    'IV(C)',
    'IV(C) Responsibilities of Supervisors',
    'Make reasonable efforts to ensure that anyone subject to your supervision or authority complies with applicable laws, rules, regulations, and the Code and Standards.',
    'standard',
    43
  ),
  (
    'V',
    'Standard V: Investment Analysis, Recommendations, and Actions',
    'Diligence, clear communication, and record retention support every recommendation and action.',
    'standard',
    50
  ),
  (
    'V(A)',
    'V(A) Diligence and Reasonable Basis',
    'Exercise diligence, independence, and thoroughness in analyzing investments, making recommendations, and taking investment actions. Have a reasonable and adequate basis, supported by research.',
    'standard',
    51
  ),
  (
    'V(B)',
    'V(B) Communication with Clients and Prospective Clients',
    'Disclose the basic format and general principles of the investment process. Distinguish fact from opinion. Communicate significant limitations and risks.',
    'standard',
    52
  ),
  (
    'V(C)',
    'V(C) Record Retention',
    'Develop and maintain appropriate records to support investment analysis, recommendations, actions, and other investment-related communications.',
    'standard',
    53
  ),
  (
    'VI',
    'Standard VI: Conflicts of Interest',
    'Disclose conflicts, put client and employer transactions first, and reveal referral fees.',
    'standard',
    60
  ),
  (
    'VI(A)',
    'VI(A) Disclosure of Conflicts',
    'Make full and fair disclosure of all matters that could reasonably be expected to impair independence and objectivity or interfere with duties to clients, prospective clients, and the employer.',
    'standard',
    61
  ),
  (
    'VI(B)',
    'VI(B) Priority of Transactions',
    'Investment transactions for clients and employers have priority over transactions in which a member or candidate is the beneficial owner.',
    'standard',
    62
  ),
  (
    'VI(C)',
    'VI(C) Referral Fees',
    'Disclose to the employer, clients, and prospective clients, as appropriate, any compensation, consideration, or benefit received from or paid to others for the recommendation of products or services.',
    'standard',
    63
  ),
  (
    'VII',
    'Standard VII: Responsibilities as a CFA Institute Member or CFA Candidate',
    'Protect the integrity of CFA Institute programs and of references to the designation.',
    'standard',
    70
  ),
  (
    'VII(A)',
    'VII(A) Conduct as Participants in CFA Institute Programs',
    'Do not engage in any conduct that compromises the reputation or integrity of CFA Institute or the integrity, validity, or security of CFA Institute programs.',
    'standard',
    71
  ),
  (
    'VII(B)',
    'VII(B) Reference to CFA Institute, the CFA Designation, and the CFA Program',
    'When referring to CFA Institute, the CFA designation, or candidacy, do not misrepresent or exaggerate the meaning or implications of membership, candidacy, or the charter.',
    'standard',
    72
  )
on conflict (code) do nothing;

insert into public.themes (name, palette_json, is_professional_locked)
select v.name, v.palette_json::jsonb, true
from (
  values
    ('Deep Navy / Gold', '{"bg":"#0B1B2B","accent":"#C9A227","text":"#F5F1E8"}'),
    ('Charcoal / Ivory', '{"bg":"#1C1C1C","accent":"#C9A227","text":"#F5F1E8"}'),
    ('CFA Blue / Gold', '{"bg":"#003A70","accent":"#C9A227","text":"#F5F1E8"}'),
    ('Muted Teal / Ivory', '{"bg":"#1F3B3B","accent":"#C9A227","text":"#F5F1E8"}'),
    ('Burgundy / Ivory', '{"bg":"#3B1F2B","accent":"#C9A227","text":"#F5F1E8"}'),
    ('Slate / Gold', '{"bg":"#2B2F3B","accent":"#C9A227","text":"#F5F1E8"}')
) as v(name, palette_json)
where not exists (
  select 1 from public.themes t where t.name = v.name
);
