const axios = require('axios');
const sessionStore = require('../utils/sessionStore');
const Candidate = require('../models/Candidate');
const Job = require('../models/Job');
const Skill = require('../models/Skill');
const Conversation = require('../models/Conversation');
const slotService = require('../services/slot.service');
const appointmentService = require('../services/appointments.service');
const mongoose = require('mongoose');

class GPTDialogueService {
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
    this.apiUrl = 'https://api.openai.com/v1/chat/completions';
    this.model = 'gpt-4o-mini';
  }

  async processDialogue(sessionId, candidateMessage, recruiterId) {
    const session = await sessionStore.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const candidate = await Candidate.findById(session.candidateId);
    if (!candidate) {
      throw new Error('Candidate not found');
    }

    if (!session.conversationHistory) {
      session.conversationHistory = [];
      const systemPrompt = this._buildSystemPrompt();
      session.conversationHistory.push({
        role: 'system',
        content: systemPrompt,
      });
    }

    session.conversationHistory.push({
      role: 'user',
      content: candidateMessage,
    });

    const currentStep = session.step || 0;
    const stepResponse = await this._handleStep(currentStep, session, candidate, candidateMessage, recruiterId);

    session.conversationHistory.push({
      role: 'assistant',
      content: stepResponse.message,
    });

    await sessionStore.update(sessionId, {
      conversationHistory: session.conversationHistory,
      entities: { ...session.entities, ...stepResponse.entities },
      step: stepResponse.nextStep,
      jobId: stepResponse.jobId || session.jobId,
    });

    await Conversation.create({
      candidate_id: session.candidateId,
      transcript: candidateMessage,
      entities_extracted: stepResponse.entities || {},
    });

    return {
      message: stepResponse.message,
      nextStep: stepResponse.nextStep,
      entities: stepResponse.entities,
      endCall: stepResponse.endCall || false,
    };
  }

  async _handleStep(step, session, candidate, candidateMessage, recruiterId) {
    switch (step) {
      case 0:
        return this._handleIntroduction(candidate);
      case 1:
        return this._extractBasicInfoAndFindJobs(session, candidateMessage);
      case 2:
        return this._presentJob(session);
      case 3:
        return this._extractLocationPreference(session, candidateMessage);
      case 4:
        return this._extractCTCAndNotice(session, candidateMessage);
      default:
        if (step >= 5 && session.jobId) {
          const job = await Job.findById(session.jobId).populate('skills');
          const skillIndex = step - 5;

          if (skillIndex < job.skills.length) {
            return this._handleSkillRating(skillIndex, session, job, candidateMessage);
          } else if (skillIndex === job.skills.length) {
            return this._evaluateAndSchedule(session, candidate, job);
          } else {
            return this._confirmAppointment(session, candidateMessage, recruiterId);
          }
        } else if (step === 5 && !session.jobId) {
          await Candidate.findByIdAndUpdate(candidate._id, {
            status: 'rejected',
          });
          return {
            message:
              "Sorry, we don’t have any roles that match your skills right now. I’ll keep your details on file and reach out if something comes up. Thanks for chatting with me!",
            nextStep: step + 1,
            entities: {},
            endCall: true,
          };
        } else {
          return {
            message: "Thanks for your time! Anything else you’d like to discuss about the role?",
            nextStep: step,
            entities: {},
          };
        }
    }
  }

  async _handleIntroduction(candidate) {
    const greetings = [
      `Hi ${candidate.name}, this is Alex from TechRecruit. How’s your day going?`,
      `Hello ${candidate.name}, I’m Alex from TechRecruit. Got a minute to chat?`,
      `Hey ${candidate.name}, Alex here from TechRecruit. Hope you’re doing well!`,
    ];
    const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];

    return {
      message: `${randomGreeting} We’re on the lookout for talented folks like you for some exciting tech roles. Could you tell me a bit about your experience and skills?`,
      nextStep: 1,
      entities: {},
    };
  }

  async _extractBasicInfoAndFindJobs(session, candidateMessage) {
    const prompt = `
    Extract the following information from the candidate's introduction:
    - years_of_experience: Number (total years of professional experience)
    - current_company: String (if mentioned)
    - education: String (highest education level and field)
    - key_skills: Array of Strings (technical skills mentioned)
    - about: String (a short summary of their professional background)
    
    Format as JSON. If information is not available, use null.
    `;

    const entities = await this._extractEntities(prompt, candidateMessage);

    await Candidate.findByIdAndUpdate(session.candidateId, {
      about: entities.about || '',
      experience: entities.years_of_experience || 0,
      skills: entities.key_skills || [],
    });

    let matchingJobs = [];
    if (entities.key_skills && entities.key_skills.length > 0 && entities.about) {
      const keywords = [...entities.key_skills, ...entities.about.split(' ')].join(' ');

      matchingJobs = await Job.find({
        $text: { $search: keywords },
        min_experience: { $lte: entities.years_of_experience || 0 },
      })
        .sort({ score: { $meta: 'textScore' }, created_at: -1 })
        .limit(1)
        .populate('skills');
    }

    if (matchingJobs.length === 0) {
      return {
        message:
          "Thanks for telling me about yourself! We don’t have a perfect match right now, but I’d love to know your location preferences and salary expectations to keep on file.",
        nextStep: 3,
        entities,
      };
    }

    const bestJob = matchingJobs[0];
    session.jobId = bestJob._id;
    await session.save();

    return {
      message: "Awesome, thanks for sharing! I’ve found a role that might be a great fit for you based on what you’ve told me.",
      nextStep: 2,
      entities,
      jobId: bestJob._id,
    };
  }

  async _presentJob(session) {
    const job = await Job.findById(session.jobId);
    if (!job) {
      return {
        message:
          "Oops, I couldn’t pull up the job details just now. Let’s keep going—what’s your preference for work setup? Remote, hybrid, or maybe relocating?",
        nextStep: 3,
        entities: {},
      };
    }

    const jobDescription = `So, we’ve got an opening for a ${job.title}. ${job.description} It’s looking for someone with at least ${job.min_experience} years of experience.`;
    const locationInfo = job.job_type ? `It’s a ${job.job_type} role${job.location ? ` based in ${job.location}` : ''}.` : '';
    const ctcInfo = job.ctc_range
      ? `The pay range is between ${job.ctc_range.min} and ${job.ctc_range.max} lakhs per year.`
      : '';
    const interestQuestion = `What do you think—does this sound like something you’d be interested in, and does the ${job.job_type} setup${job.location ? ` in ${job.location}` : ''} work for you?`;

    return {
      message: `${jobDescription} ${locationInfo} ${ctcInfo} ${interestQuestion}`,
      nextStep: 3,
      entities: {},
    };
  }

  async _extractLocationPreference(session, candidateMessage) {
    const prompt = `
    Extract the candidate's work location preference and interest in the role:
    - remote_preferred: Boolean (true/false)
    - hybrid_preferred: Boolean (true/false)
    - onsite_preferred: Boolean (true/false)
    - can_relocate: Boolean (true/false)
    - interested_in_role: Boolean (true if interested, false if not, null if unclear)
    
    Format as JSON. If information isn't clear, use null.
    `;

    const entities = await this._extractEntities(prompt, candidateMessage);

    if (entities.interested_in_role === false) {
      await Candidate.findByIdAndUpdate(session.candidateId, {
        status: 'rejected',
      });
      return {
        message:
          "Got it, thanks for letting me know. I’ll keep your info handy for other roles that might catch your eye later. Take care!",
        nextStep: 5,
        entities,
        endCall: true,
      };
    }

    let locationPreference = 'flexible';
    if (entities.remote_preferred) locationPreference = 'remote';
    else if (entities.hybrid_preferred) locationPreference = 'hybrid';
    else if (entities.onsite_preferred) locationPreference = 'onsite';

    const job = await Job.findById(session.jobId);
    if (job && job.job_type && locationPreference !== 'flexible' && job.job_type !== locationPreference) {
      await Candidate.findByIdAndUpdate(session.candidateId, {
        status: 'rejected',
      });
      return {
        message: `Thanks for that! This role is ${job.job_type}, which doesn’t quite match your preference. I’ll keep an eye out for something that does. Have a great day!`,
        nextStep: 5,
        entities,
        endCall: true,
      };
    }

    await Candidate.findByIdAndUpdate(session.candidateId, {
      location_preference: locationPreference,
    });

    return {
      message: "Perfect, thanks! Mind sharing your current salary, what you’re hoping for, and your notice period?",
      nextStep: 4,
      entities,
    };
  }

  async _extractCTCAndNotice(session, candidateMessage) {
    const prompt = `
    Extract the following salary and notice period information:
    - current_ctc: Number (in lakhs, extract just the number)
    - expected_ctc: Number (in lakhs, extract just the number)
    - notice_period: String (in days/weeks/months)
    
    Format as JSON. If information isn't available, use null.
    `;

    const entities = await this._extractEntities(prompt, candidateMessage);

    await Candidate.findByIdAndUpdate(session.candidateId, {
      current_ctc: entities.current_ctc || null,
      expected_ctc: entities.expected_ctc || null,
      notice_period: entities.notice_period || null,
    });

    if (!session.jobId) {
      return {
        message:
          "Thanks for that info! We’ll keep it on record and reach out when we find a good match. What kind of roles are you most excited about for the future?",
        nextStep: 5,
        entities,
      };
    }

    const job = await Job.findById(session.jobId);

    if (
      job.ctc_range &&
      entities.expected_ctc &&
      entities.expected_ctc > job.ctc_range.max * 1.2
    ) {
      await Candidate.findByIdAndUpdate(session.candidateId, {
        status: 'rejected',
      });
      return {
        message: `Appreciate you sharing that. Your expected salary of ${entities.expected_ctc} lakhs is a bit above this role’s range of ${job.ctc_range.min}-${job.ctc_range.max} lakhs. I’ll keep you in mind for something that fits better. Take care!`,
        nextStep: 5,
        entities,
        endCall: true,
      };
    }

    const jobWithSkills = await Job.findById(session.jobId).populate('skills');
    const firstSkill = jobWithSkills.skills[0]?.name || 'a relevant skill';

    return {
      message: `Great, thanks for that! Let’s talk skills—how would you rate yourself in ${firstSkill} on a scale of 1 to 5, with 5 being expert level?`,
      nextStep: 5,
      entities,
    };
  }

  async _handleSkillRating(skillIndex, session, job, candidateMessage) {
    const prompt = `
    Extract the candidate's self-rating of their skill:
    - rating: Number (1-5)
    
    Format as JSON with just the rating number. If not clear, use null.
    `;

    const extractedData = await this._extractEntities(prompt, candidateMessage);
    const rating = extractedData.rating || 3;

    const skillId = job.skills[skillIndex]?._id;
    const entities = {
      skillRatings: { ...(session.entities.skillRatings || {}) },
    };
    if (skillId) {
      entities.skillRatings[skillId] = rating;
    }

    const candidate = await Candidate.findById(session.candidateId);
    if (skillId) {
      const existingRatingIndex = candidate.ratings.findIndex(
        (r) => r.skill.toString() === skillId.toString()
      );

      if (existingRatingIndex >= 0) {
        candidate.ratings[existingRatingIndex].rating = rating;
      } else {
        candidate.ratings.push({
          skill: skillId,
          rating: rating,
        });
      }
      await candidate.save();
    }

    const nextSkillIndex = skillIndex + 1;
    if (nextSkillIndex < job.skills.length) {
      const nextSkill = job.skills[nextSkillIndex].name;
      return {
        message: `Cool, thanks! How about ${nextSkill}—where would you place yourself on that 1-to-5 scale?`,
        nextStep: 5 + nextSkillIndex,
        entities,
      };
    } else {
      return {
        message: "Awesome, that’s all the skills I needed to check. Give me a sec to see how you match up with the role.",
        nextStep: 5 + job.skills.length,
        entities,
      };
    }
  }

  async _evaluateAndSchedule(session, candidate, job) {
    await Candidate.findByIdAndUpdate(candidate._id, {
      jobAssignment: job._id,
    });

    const skillRatings = session.entities.skillRatings || {};
    let totalRating = 0;
    let skillsRated = 0;

    for (const skill of job.skills) {
      const rating = skillRatings[skill._id] || 0;
      totalRating += rating;
      skillsRated++;
    }

    const averageRating = skillsRated > 0 ? totalRating / skillsRated : 0;
    const matchPercentage = (averageRating / 5) * 100;

    const entities = {
      matchPercentage,
    };

    const experienceMatches = candidate.experience >= job.min_experience;

    if (matchPercentage < 70 || !experienceMatches) {
      await Candidate.findByIdAndUpdate(candidate._id, {
        status: 'rejected',
        score:matchPercentage,
      });

      let message = "Thanks so much for chatting with me! After looking things over, ";
      if (!experienceMatches) {
        message += `this role needs at least ${job.min_experience} years of experience, so it might not be the best fit right now.`;
      } else {
        message += "we’re looking for a bit more depth in some of the skills for this one.";
      }
      message += " I’ll keep your profile handy for future openings. Have a great day!";

      return {
        message,
        nextStep: session.step + 1,
        entities,
        endCall: true,
      };
    }

    const twoHoursFromNow = new Date();
    twoHoursFromNow.setHours(twoHoursFromNow.getHours() + 2);

    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    const availableSlots = await slotService.getAvailableSlots(twoHoursFromNow, nextWeek);

    await Candidate.findByIdAndUpdate(candidate._id, {
      status: 'shortlisted',
      score:matchPercentage,
    });

    if (availableSlots.length === 0) {
      return {
        message:
          "Good news—you’re a great fit for this role! We’re a bit booked up on interview slots right now, but someone from the team will reach out soon to set something up. Thanks for your time!",
        nextStep: session.step + 1,
        entities,
        endCall: true,
      };
    }

    const formattedSlots = availableSlots.slice(0, 3).map((slot, index) => {
      const date = new Date(slot.date);
      const dateStr = date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      });
      return `Option ${index + 1}: ${dateStr} from ${slot.start_time} to ${slot.end_time}`;
    }).join(', ');

    entities.availableSlots = availableSlots.slice(0, 3).map((slot) => slot._id);

    return {
      message: `Exciting stuff—you’re a ${Math.round(matchPercentage)}% match for this role! I’d love to get an interview set up. Here are some options: ${formattedSlots}. Which one works for you?`,
      nextStep: session.step + 1,
      entities,
    };
  }

  async _confirmAppointment(session, candidateMessage, recruiterId) {
    const prompt = `
    Extract which interview slot option the candidate chose:
    - option_number: Number (1, 2, or 3)
    - confirm: Boolean (true if they confirmed the slot, false if not)
    - not_available: Boolean (true if they indicate none of the slots work)
    
    Format as JSON. If they didn't specify an option clearly, use null for option_number.
    `;

    const extractedData = await this._extractEntities(prompt, candidateMessage);
    const { option_number, confirm, not_available } = extractedData;

    if (not_available) {
      const twoHoursFromNow = new Date();
      twoHoursFromNow.setHours(twoHoursFromNow.getHours() + 2);
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);

      const alternativeSlots = await slotService.getAvailableSlots(twoHoursFromNow, nextWeek);
      const filteredAlternativeSlots = alternativeSlots
        .filter((slot) => !session.entities.availableSlots.includes(slot._id))
        .slice(0, 3);

      if (filteredAlternativeSlots.length === 0) {
        return {
          message:
            "No worries, I get that those times didn’t work. We’re out of slots for now, but the team will reach out to find a time that suits you. Thanks for your patience!",
          nextStep: session.step + 1,
          entities: {},
          endCall: true,
        };
      }

      const formattedAlternativeSlots = filteredAlternativeSlots.map((slot, index) => {
        const date = new Date(slot.date);
        const dateStr = date.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        });
        return `Option ${index + 1}: ${dateStr} from ${slot.start_time} to ${slot.end_time}`;
      }).join(', ');

      const entities = {
        availableSlots: filteredAlternativeSlots.map((slot) => slot._id),
      };

      return {
        message: `Thanks for letting me know! How about these instead: ${formattedAlternativeSlots}. Any of those work for you?`,
        nextStep: session.step,
        entities,
      };
    }

    if (option_number === null && !confirm) {
      return {
        message:
          "Oops, I didn’t catch which slot you wanted. Could you let me know which option fits your schedule?",
        nextStep: session.step,
        entities: {},
      };
    }

    const availableSlots = session.entities.availableSlots || [];
    const slotId = availableSlots[option_number - 1] || availableSlots[0];

    if (!slotId) {
      return {
        message:
          "Hmm, looks like there was a glitch with the scheduling. No worries—someone from the team will follow up to get this sorted. Thanks for your time!",
        nextStep: session.step + 1,
        entities: {},
        endCall: true,
      };
    }

    try {
      await slotService.reserveSlot(slotId);

      const slot = await mongoose.model('Slot').findById(slotId);
      const date = new Date(slot.date);
      const googleMeetLink = await this._createGoogleMeetLink(
        session.candidateId,
        session.jobId,
        slot
      );

      await appointmentService.create({
        job_id: session.jobId,
        candidate_id: session.candidateId,
        slot_id: slotId,
        meeting_link: googleMeetLink,
        recruiterId: recruiterId,
      });

      const dateStr = date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      });

      await Candidate.findByIdAndUpdate(session.candidateId, {
        status: 'shortlisted',
      });

      return {
        message: `All set! Your interview’s booked for ${dateStr} from ${slot.start_time} to ${slot.end_time}. Check your email soon for a Google Meet link. Good luck, and thanks for chatting with me!`,
        nextStep: session.step + 1,
        entities: { appointmentConfirmed: true },
        endCall: true,
      };
    } catch (error) {
      console.error('Error creating appointment:', error);
      return {
        message:
          "Sorry, something went wrong while booking that slot. The team will reach out to fix this for you. Thanks for your time!",
        nextStep: session.step + 1,
        entities: {},
        endCall: true,
      };
    }
  }

  async _createGoogleMeetLink(candidateId, jobId, slot) {
    const eventId = Math.random().toString(36).substring(2, 8);
    const meetingLink = `https://meet.google.com/tech-recruit-${eventId}`;
    return meetingLink;
  }

  async _extractEntities(prompt, text) {
    try {
      const response = await axios.post(
        this.apiUrl,
        {
          model: this.model,
          messages: [
            { role: 'system', content: prompt },
            { role: 'user', content: text },
          ],
          temperature: 0.1,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const assistantResponse = response.data.choices[0]?.message.content;
      if (!assistantResponse) {
        throw new Error('No response content from GPT API');
      }

      try {
        return JSON.parse(assistantResponse);
      } catch (parseError) {
        console.error('Error parsing GPT response as JSON:', parseError);
        console.log('Raw response:', assistantResponse);
        return {};
      }
    } catch (error) {
      console.error('Error calling GPT API:', error.response?.data || error.message);
      return {};
    }
  }

  _buildSystemPrompt() {
    return `
You are a friendly and professional recruiter named Alex from TechRecruit, calling to screen candidates for tech roles. Your job is to chat naturally, like a real person, while guiding the conversation through these steps:

1. Say hi, introduce yourself and TechRecruit, and ask about their experience and skills.
2. Figure out their background, experience, and technical skills.
3. Match them to a job based on what they tell you.
4. Ask about their work setup preferences (remote, hybrid, onsite).
5. Get their current salary, expected salary, and notice period.
6. Rate their skills (1-5) for the job you matched them to.
7. If they’re a good fit (70%+ skill match and enough experience), schedule an interview.

Here’s how to do it:
- Be warm, casual, and engaging—like you’re catching up with a colleague.
- Mix up your phrasing so you don’t sound repetitive or scripted.
- Use the candidate’s name sometimes to make it personal.
- If they’re unsure, give a gentle nudge to keep them talking.
- If they wander off-topic, steer them back kindly.
- End the call nicely if they’re not a fit or want to stop—keep it positive.
- For interviews, offer slots at least 2 hours from now and create a Google Meet link.
- If they can’t make the slots, suggest alternatives or let the team follow up.

If they seem uninterested, thank them and wrap up politely—no pressure!
`;
  }
}

module.exports = new GPTDialogueService();