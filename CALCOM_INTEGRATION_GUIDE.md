# Cal.com Integration Guide

## Overview
The interview scheduling system has been successfully migrated from Google Calendar to **Cal.com** for managing interview appointments.

**✅ Using Cal.com API v2** (Latest version with `cal-api-version: 2026-02-25`)

---

## Changes Made

### 1. **Controller Updates** (`src/controllers/interview.controller.js`)

#### Removed Dependencies:
- `googleapis` - No longer needed for Google Calendar API
- OAuth2 configuration for Google Calendar

#### Added Dependencies:
- `axios` - For making HTTP requests to Cal.com API

#### New Function: `createCalComBooking()`
This function handles creating bookings through Cal.com's **v2 API**:
- Formats date/time from slot information
- Creates booking with candidate details using v2 format
- Includes required `cal-api-version: 2026-02-25` header
- Returns meeting link and booking information
- Stores metadata (candidate ID, interview type)

**Key v2 Changes:**
- Uses `attendee` object instead of flat fields
- Response data wrapped in `data` property (`response.data.data`)
- Requires API version header
- Improved error handling

#### Updated Functions:
- `scheduleInterview()` - Now uses Cal.com instead of Google Meet
- `scheduleInterviewRecruiter()` - Now uses Cal.com instead of Google Meet

Both functions now:
- Call `createCalComBooking()` instead of `createGoogleMeetAppointment()`
- Store `cal_com_booking_id` and `cal_com_uid` in appointment records
- Return Cal.com booking details in response

---

### 2. **Model Updates** (`src/models/Appointment.js`)

Added new fields to store Cal.com booking information:
```javascript
cal_com_booking_id: {
  type: String,
  // Store Cal.com booking ID
},
cal_com_uid: {
  type: String,
  // Store Cal.com booking UID
}
```

---

### 3. **Environment Variables** (`.env`)

Added Cal.com v2 configuration:
```env
# Cal.com API v2 Configuration
CALCOM_API_URL=https://api.cal.com/v2
CALCOM_API_KEY=your_cal_com_api_key_here
CALCOM_EVENT_TYPE_ID=your_event_type_id_here
```

**Important:** The integration uses Cal.com API v2 with the required header `cal-api-version: 2026-02-25`

---

## Setup Instructions

### Step 1: Get Your Cal.com API Key

1. Log in to your Cal.com account
2. Go to **Settings** → **Developer** → **API Keys**
3. Click **"Create New API Key"**
4. Give it a name (e.g., "Interview Scheduling")
5. Copy the generated API key

### Step 2: Create an Event Type

1. In Cal.com, go to **Event Types**
2. Click **"New Event Type"** or use an existing one
3. Configure your interview event:
   - Name: "Interview" or specific types like "Initial Screening"
   - Duration: Set appropriate duration (e.g., 30 minutes)
   - Availability: Set your available time slots
   - Location: Choose video conferencing provider (Google Meet, Zoom, etc.)
4. Note the **Event Type ID** from the URL when editing the event type

### Step 3: Update Environment Variables

Replace the placeholder values in `.env`:

```env
CALCOM_API_URL=https://api.cal.com/v2
CALCOM_API_KEY=your_actual_api_key_from_step_1
CALCOM_EVENT_TYPE_ID=your_actual_event_type_id_from_step_2
```

**Note:** Make sure you're using the v2 API endpoint (`https://api.cal.com/v2`)

### Step 4: Install Dependencies (if not already installed)

The project already has `axios` installed, but if needed:

```bash
npm install axios
```

### Step 5: Test the Integration

1. Start your server:
   ```bash
   npm run dev
   ```

2. Make a test request to schedule an interview:
   ```javascript
   POST /api/interviews/schedule
   Content-Type: application/json
   Authorization: Bearer <your_token>

   {
     "candidateId": "candidate_id_here",
     "slotId": "slot_id_here",
     "interviewType": "initial",
     "job_id": "job_id_here"
   }
   ```

3. Check the response - it should include:
   - `meeting_link`: The Cal.com meeting URL
   - `cal_com_booking_id`: The booking ID from Cal.com
   - `cal_com_uid`: The booking UID from Cal.com

---

## API Response Format

### Success Response (201 Created):
```json
{
  "appointment": {
    "id": "appointment_id",
    "date": "2026-04-01T00:00:00.000Z",
    "start_time": "10:00",
    "end_time": "10:30",
    "interview_type": "initial",
    "meeting_link": "https://cal.com/video/xxx-yyy-zzz",
    "cal_com_booking_id": "12345",
    "cal_com_uid": "abc-def-ghi"
  },
  "candidate": {
    "id": "candidate_id",
    "name": "Candidate Name",
    "email": "candidate@email.com",
    "status": "screening"
  }
}
```

---

## How It Works

1. **Slot Selection**: User selects an available time slot
2. **Booking Creation**: System calls Cal.com **v2 API** with:
   - Event type ID
   - Start time (ISO 8601 format)
   - Attendee information (name, email, timezone)
   - Interview metadata
   - Required header: `cal-api-version: 2026-02-25`
3. **Meeting Link Generation**: Cal.com creates the booking and returns:
   - Meeting URL (configured based on your Cal.com settings)
   - Booking ID and UID
   - Calendar invites are sent automatically by Cal.com
4. **Record Storage**: System stores all booking information in MongoDB

**Key Changes in v2:**
- Uses `attendee` object instead of flat `name` and `email` fields
- Response data is wrapped in `data` property (`response.data.data`)
- Requires `cal-api-version` header
- Improved error handling and response structure

---

## Benefits of Cal.com Integration

✅ **Simpler Setup**: No complex OAuth2 configuration  
✅ **Flexible**: Supports multiple video providers (Zoom, Google Meet, Teams, etc.)  
✅ **Automated**: Handles calendar invites and reminders automatically  
✅ **Open Source**: Self-hostable option available  
✅ **Better API**: Cleaner REST API compared to Google Calendar  

---

## Troubleshooting

### Error: "Failed to create Cal.com booking"

**Possible Causes:**
- Invalid API key
- Incorrect Event Type ID
- Missing `cal-api-version` header
- API rate limits exceeded

**Solution:**
1. Verify your API key in Cal.com dashboard
2. Check that the Event Type ID is correct (it should be a number)
3. Ensure the `cal-api-version: 2026-02-25` header is included
4. Verify you're using the v2 endpoint: `https://api.cal.com/v2`
5. Ensure your Cal.com account is active

### Error: "Missing environment variables"

**Solution:**
Make sure `.env` file contains:
```env
CALCOM_API_URL=https://api.cal.com/v2
CALCOM_API_KEY=your_key
CALCOM_EVENT_TYPE_ID=your_id
```

### No Meeting Link in Response

**Possible Causes:**
- Cal.com event type not configured with video conferencing
- Incorrect response parsing (v2 wraps data in `data` property)

**Solution:**
1. Check your Cal.com event type settings
2. Ensure a video conferencing provider is configured
3. Verify the code extracts data from `response.data.data` (v2 format)
4. Review Cal.com v2 API documentation for any updates

---

## Additional Resources

- [Cal.com API v2 Documentation](https://cal.com/docs/api-reference/v2/introduction)
- [Cal.com v2 Bookings Endpoint](https://cal.com/docs/api-reference/v2/bookings/create-a-booking)
- [Migrating from v1 to v2](https://cal.com/docs/api-reference/v2/v1-v2-differences)
- [Cal.com Developer Portal](https://cal.com/developers)

---

## Support

For issues or questions about Cal.com integration, refer to:
- Cal.com Documentation: https://cal.com/docs
- Cal.com Support: support@cal.com
