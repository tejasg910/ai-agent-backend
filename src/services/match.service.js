// services/matchingService.js

const { openai } = require("../utils/openAi");

// Initialize OpenAI client


/**
 * Calculates match score between candidate and job
 * @param {Object} candidate - Candidate data
 * @param {Object} job - Job data with populated skills
 * @returns {Promise<number>} - Match percentage (0-100)
 */


exports.matchCandidateToJob = async (candidate, job) => {
  try {
    // Extract job details
    const jobTitle = job.title;
    const jobDescription = job.description;
    const jobRequirements = job.requirements || '';
    const minExperience = job.min_experience || 0;
    const jobSkills = job.skills.map(skill => skill.name || skill).join(', ');
    const jobLocation = job.job_type || 'onsite';

    // Extract candidate details
    const candidateAbout = candidate.about || '';
    const candidateExperience = candidate.experience || 0;
    const candidateLocation = candidate.location_preference || 'flexible';
    
    // Get skill ratings
    const skillRatings = candidate.ratings || [];
    
    // Calculate initial basic match factors
    let basicMatchScore = 0;
    
    // Check experience match
    if (candidateExperience >= minExperience) {
      basicMatchScore += 20;
    } else if (candidateExperience >= minExperience * 0.8) {
      basicMatchScore += 10;
    }
    
    // Check location compatibility
    if (candidateLocation === jobLocation || candidateLocation === 'flexible') {
      basicMatchScore += 10;
    } else if ((jobLocation === 'hybrid' && candidateLocation === 'onsite') || 
              (jobLocation === 'onsite' && candidateLocation === 'hybrid')) {
      basicMatchScore += 5;
    }
    
    // Calculate skill match if skills are provided
    let skillMatchScore = 0;
    if (skillRatings.length > 0) {
      // Calculate average rating
      const totalRating = skillRatings.reduce((sum, rating) => sum + rating.rating, 0);
      const averageRating = totalRating / skillRatings.length;
      
      // Scale to percentage (1-5 rating to 0-30%)
      skillMatchScore = (averageRating / 5) * 30;
    }
    
    // Use OpenAI to analyze semantic match between candidate and job description
    const semanticMatchScore = await analyzeSemanticMatch(candidateAbout, jobTitle, jobDescription, jobRequirements, jobSkills);
    
    // Combine scores: basic match (30%), skill ratings (30%), semantic analysis (40%)
    const totalScore = basicMatchScore + skillMatchScore + semanticMatchScore;
    
    return Math.min(Math.round(totalScore), 100);
  } catch (error) {
    console.error('Error calculating match score:', error);
    // Return a default score if analysis fails
    return 50;
  }
};

/**
 * Analyzes semantic match between candidate and job using OpenAI
 * @returns {Promise<number>} - Score from 0-40
 */
async function analyzeSemanticMatch(candidateAbout, jobTitle, jobDescription, jobRequirements, jobSkills) {
  try {
    if (!candidateAbout || candidateAbout.trim() === '') {
      return 20; // Default middle score if no about info
    }
    
    const prompt = `
      As an AI recruitment assistant, analyze how well this candidate matches the job requirements.
      
      JOB INFORMATION:
      Title: ${jobTitle}
      Description: ${jobDescription}
      Requirements: ${jobRequirements}
      Key Skills: ${jobSkills}
      
      CANDIDATE INFORMATION:
      About: ${candidateAbout}
      
      Based on the semantic analysis of the candidate's background and the job requirements,
      provide a match score from 0 to 40, where:
      0-10: Poor match
      11-20: Below average match
      21-30: Good match
      31-40: Excellent match
      
      Return only the numeric score.
    `;
    
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 10
    });
    
    const scoreText = response.choices[0].message.content.trim();
    const score = parseInt(scoreText, 10);
    
    if (isNaN(score) || score < 0 || score > 40) {
      return 20; // Default to middle score if parsing fails
    }
    
    return score;
  } catch (error) {
    console.error('Error in semantic analysis:', error);
    return 20; // Default middle score on error
  }
}