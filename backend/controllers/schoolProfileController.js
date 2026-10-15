import SchoolProfile from '../models/SchoolProfile.js';

/**
 * Get School Profile for branding and print templates
 */
export const getSchoolProfile = async (req, res) => {
  try {
    const { schoolCode } = req.query;
    if (!schoolCode) {
      return res.status(400).json({ success: false, message: 'School code is required.' });
    }

    const code = schoolCode.toUpperCase().trim();
    let profile = await SchoolProfile.findOne({ schoolCode: code }).lean();

    if (!profile) {
      profile = await SchoolProfile.create({
        schoolCode: code,
        schoolName: code === 'SCH-101' ? 'ISLAMABAD MODEL COLLEGE FOR BOYS' : `Akkhor Model School (${code})`,
        address: 'PAKISTAN TOWN, ISLAMABAD',
        tagline: 'Excellence in Education & Character Building',
        phone: '+92 51 9283741',
        email: 'info@school.edu.pk',
        affiliation: 'Affiliated with Federal Board (FBISE)',
        principalTitle: 'Principal',
        vicePrincipalTitle: 'Vice Principal',
        activeSession: '2025-2026',
      });
    }

    return res.status(200).json({ success: true, data: profile });
  } catch (error) {
    console.error('Error in getSchoolProfile:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Update School Profile
 */
export const updateSchoolProfile = async (req, res) => {
  try {
    const {
      schoolCode,
      schoolName,
      tagline,
      address,
      phone,
      email,
      affiliation,
      principalTitle,
      vicePrincipalTitle,
      logoUrl,
      principalSignatureUrl,
      activeSession,
    } = req.body;

    if (!schoolCode) {
      return res.status(400).json({ success: false, message: 'School code is required.' });
    }

    const code = schoolCode.toUpperCase().trim();

    const profile = await SchoolProfile.findOneAndUpdate(
      { schoolCode: code },
      {
        $set: {
          schoolName: schoolName ? schoolName.trim() : 'ISLAMABAD MODEL COLLEGE FOR BOYS',
          tagline: tagline ? tagline.trim() : '',
          address: address ? address.trim() : '',
          phone: phone ? phone.trim() : '',
          email: email ? email.trim() : '',
          affiliation: affiliation ? affiliation.trim() : '',
          principalTitle: principalTitle ? principalTitle.trim() : 'Principal',
          vicePrincipalTitle: vicePrincipalTitle ? vicePrincipalTitle.trim() : 'Vice Principal',
          logoUrl: logoUrl !== undefined ? logoUrl : null,
          principalSignatureUrl: principalSignatureUrl !== undefined ? principalSignatureUrl : null,
          activeSession: activeSession || '2025-2026',
        },
      },
      { upsert: true, new: true }
    );

    // Emit real-time school branding update to all connected clients
    if (req.io) {
      req.io.to(`school:${code}`).emit('school_profile_updated', profile);
      req.io.to('role:SUPER_ADMIN').emit('school_profile_updated', profile);
    }

    return res.status(200).json({
      success: true,
      message: 'School profile & branding updated successfully.',
      data: profile,
    });
  } catch (error) {
    console.error('Error in updateSchoolProfile:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
