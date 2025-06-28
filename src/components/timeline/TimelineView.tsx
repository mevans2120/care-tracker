'use client'

import { useState, useEffect } from 'react'
import { Gear, Pill, FirstAid, Person, Bandaids, Drop, Car, ChartLine, Books, NotePencil, Warning, Clock, Shower } from 'phosphor-react'
import { useCareStore } from '@/store/careStore'
import { TaskStatus, TaskType, TaskActionType } from '@/types'
import { formatDate, formatDuration, getTimeUntil } from '@/lib/utils'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ToastContainer } from '@/components/ui/Toast'
import { SettingsPanel } from '@/components/settings/SettingsPanel'
import { useToast } from '@/hooks/useToast'

export function TimelineView() {
  const {
    tasks,
    userProfile,
    progressStats,
    completeTask,
    skipTask,
    updateProgressStats
  } = useCareStore()
  
  const [emergencyOpen, setEmergencyOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { toasts, removeToast, success, info } = useToast()

  useEffect(() => {
    updateProgressStats()
  }, [tasks, updateProgressStats])

  // Group tasks by day for scrollable timeline
  const groupTasksByDay = () => {
    const grouped: { [key: string]: any[] } = {}
    
    tasks.forEach(task => {
      const taskDate = new Date(task.scheduledTime)
      const dateKey = taskDate.toDateString()
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = []
      }
      grouped[dateKey].push(task)
    })
    
    // Sort tasks within each day
    Object.keys(grouped).forEach(dateKey => {
      grouped[dateKey].sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime())
    })
    
    return grouped
  }

  const tasksByDay = groupTasksByDay()
  const sortedDays = Object.keys(tasksByDay).sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
  
  // Calculate day number for each date (Day 1 = procedure day)
  const getDayNumber = (dateString: string) => {
    if (!userProfile) return 1
    const taskDate = new Date(dateString)
    const dischargeDate = new Date(userProfile.dischargeDate)
    
    // Set both dates to start of day for proper day calculation
    const taskDateStart = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate())
    const dischargeDateStart = new Date(dischargeDate.getFullYear(), dischargeDate.getMonth(), dischargeDate.getDate())
    
    return Math.floor((taskDateStart.getTime() - dischargeDateStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
  }

  const handleCompleteTask = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId)
    completeTask(taskId)
    
    if (task) {
      success('Task Completed!', `${task.title} has been marked as complete.`)
    }
  }

  const handleSkipTask = (taskId: string) => {
    skipTask(taskId)
  }

  const getTaskTypeIcon = (type: TaskType): JSX.Element => {
    const iconProps = { size: 20, weight: "fill" as const }
    
    const icons = {
      [TaskType.MEDICATION]: <Pill {...iconProps} />,
      [TaskType.APPOINTMENT]: <FirstAid {...iconProps} />,
      [TaskType.EXERCISE]: <Person {...iconProps} />,
      [TaskType.WOUND_CARE]: <Bandaids {...iconProps} />,
      [TaskType.DIET]: <Drop {...iconProps} />,
      [TaskType.ACTIVITY_RESTRICTION]: <Car {...iconProps} />,
      [TaskType.MONITORING]: <ChartLine {...iconProps} />,
      [TaskType.EDUCATION]: <Books {...iconProps} />,
      [TaskType.PHYSICAL_THERAPY]: <Person {...iconProps} />,
      [TaskType.MOBILITY]: <Person {...iconProps} />,
      [TaskType.BATHING]: <Shower {...iconProps} />,
      [TaskType.DRESSING]: <Person {...iconProps} />,
      [TaskType.PAIN_MANAGEMENT]: <Pill {...iconProps} />,
      [TaskType.BREATHING_EXERCISES]: <Person {...iconProps} />,
      [TaskType.EQUIPMENT_USAGE]: <Gear {...iconProps} />,
      [TaskType.FOLLOW_UP]: <FirstAid {...iconProps} />,
      [TaskType.SYMPTOM_TRACKING]: <ChartLine {...iconProps} />,
      [TaskType.POSITIONING]: <Person {...iconProps} />,
      [TaskType.OTHER]: <NotePencil {...iconProps} />
    }
    return icons[type] || <NotePencil {...iconProps} />
  }

  const getActivityCardClass = (task: any) => {
    if (task.type === TaskType.ACTIVITY_RESTRICTION) return 'activity-card cannot-do'
    if (task.actionType === TaskActionType.DO_NOT) return 'activity-card caution'
    return 'activity-card can-do'
  }

  const getActivityIconClass = (task: any) => {
    if (task.type === TaskType.ACTIVITY_RESTRICTION) return 'activity-icon icon-cannot'
    if (task.actionType === TaskActionType.DO_NOT) return 'activity-icon icon-caution'
    return 'activity-icon icon-can'
  }

  const getCurrentTime = () => {
    const now = new Date()
    return now.getHours()
  }

  const getTimeMarkerClass = (hour: number) => {
    const currentHour = getCurrentTime()
    if (hour < currentHour) return 'time-dot completed'
    if (hour === currentHour) return 'time-dot current'
    return 'time-dot'
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  if (!userProfile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  // Calculate current day since procedure (Day 1 = procedure day)
  const getCurrentDaySinceProcedure = () => {
    if (!userProfile) return 1
    const now = new Date()
    const dischargeDate = new Date(userProfile.dischargeDate)
    
    // Set both dates to start of day for proper day calculation
    const nowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const dischargeDateStart = new Date(dischargeDate.getFullYear(), dischargeDate.getMonth(), dischargeDate.getDate())
    
    return Math.floor((nowStart.getTime() - dischargeDateStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
  }
  
  const daysSinceProcedure = getCurrentDaySinceProcedure()

  return (
    <div className="timeline-container">
      {/* Header with Progress */}
      <div className="header">
        <div className="flex justify-between items-start">
          <div>
            <div className="procedure-info">{userProfile.procedure}</div>
            <h1>Your Recovery Timeline</h1>
          </div>
          <button
            onClick={() => setSettingsOpen(true)}
            className="settings-btn"
            aria-label="Open settings"
          >
            <Gear size={24} weight="regular" />
          </button>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progressStats.completionRate}%` }}></div>
        </div>
        <div className="progress-text">
          Day {daysSinceProcedure} of 7 - {daysSinceProcedure === 1 ? 'Procedure day - First 24 hours are critical' : daysSinceProcedure === 2 ? 'First day post-procedure' : 'Recovery in progress'}
        </div>
      </div>

      {/* Emergency Information */}
      <div className="emergency-section">
        <div className="emergency-header" onClick={() => setEmergencyOpen(!emergencyOpen)}>
          <h3>
            <Warning size={20} weight="fill" color="#ef4444" />
            Emergency Warning Signs - Call 911
          </h3>
          <span>{emergencyOpen ? '▲' : '▼'}</span>
        </div>
        {emergencyOpen && (
          <div className="emergency-content">
            <p><strong>Call 911 immediately if you experience:</strong></p>
            <ul>
              <li>Sudden chest pain</li>
              <li>Shortness of breath or trouble breathing</li>
              <li>Feeling light-headed, dizzy, or breaking out in cold sweat</li>
              <li>Irregular heartbeats (heart palpitations)</li>
              <li>Severe itching anywhere on your body</li>
              <li>Sudden or large amount of bleeding/swelling at procedure site</li>
              <li>Leg becomes cold, blue, or numb compared to other leg</li>
            </ul>
            <div className="emergency-number">Emergency: Call 911</div>
            <p style={{ marginTop: '15px' }}><strong>Call your doctor for:</strong></p>
            <ul>
              <li>Temperature higher than 100.5°F for more than 24 hours</li>
              <li>Increased pain not relieved by Tylenol</li>
              <li>Yellow/green drainage at procedure site</li>
            </ul>
          </div>
        )}
      </div>

      {/* Scrollable Timeline */}
      <div className="scrollable-timeline">
        <div className="timeline-line"></div>
        
        {sortedDays.map((dateString, dayIndex) => {
          const dayNumber = getDayNumber(dateString)
          const date = new Date(dateString)
          const isToday = date.toDateString() === new Date().toDateString()
          const isPast = date < new Date() && !isToday
          const tasksForDay = tasksByDay[dateString]
          
          return (
            <div key={dateString} className="day-section">
              {/* Day Header */}
              <div className={`day-header ${isToday ? 'today' : isPast ? 'past' : 'future'}`}>
                <div className="day-marker">
                  <div className={`day-dot ${isToday ? 'current' : isPast ? 'completed' : 'upcoming'}`}>
                    {dayNumber}
                  </div>
                </div>
                <div className="day-info">
                  <h3>
                    {isToday ? `Today - Day ${dayNumber}` :
                     dayNumber === 1 ? `Procedure Day` :
                     `Day ${dayNumber}`}
                  </h3>
                  <p className="day-date">
                    {date.toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                  {dayNumber === 1 && (
                    <div className="day-summary">
                      <p style={{ fontSize: '14px', opacity: 0.9, marginTop: '8px' }}>
                        Procedure day - Critical first 24 hours - You must have someone stay with you
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Tasks for this day */}
              <div className="day-tasks">
                {tasksForDay.map((task) => {
                  const taskTime = new Date(task.scheduledTime)
                  
                  return (
                    <div key={task.id} className="task-in-timeline">
                      <div className="task-time">
                        {formatTime(taskTime)}
                      </div>
                      <div className="task-content">
                        <ActivityCard
                          task={task}
                          onComplete={handleCompleteTask}
                          onSkip={handleSkipTask}
                          getTaskTypeIcon={getTaskTypeIcon}
                          getActivityCardClass={getActivityCardClass}
                          getActivityIconClass={getActivityIconClass}
                        />
                      </div>
                    </div>
                  )
                })}
                
                {tasksForDay.length === 0 && (
                  <div className="no-tasks">
                    <p style={{ opacity: 0.6, fontStyle: 'italic' }}>
                      No specific activities scheduled for this day
                    </p>
                  </div>
                )}
              </div>
            </div>
          )
        })}
        
        {/* End of timeline message */}
        <div className="timeline-end">
          <div className="day-marker">
            <div className="day-dot completed">✓</div>
          </div>
          <div className="end-message">
            <h3>Recovery Complete!</h3>
            <p>Continue following your doctor's long-term care instructions</p>
          </div>
        </div>
      </div>

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onClose={removeToast} />

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  )
}

interface ActivityCardProps {
  task: any
  onComplete: (taskId: string) => void
  onSkip: (taskId: string) => void
  getTaskTypeIcon: (type: TaskType) => JSX.Element
  getActivityCardClass: (task: any) => string
  getActivityIconClass: (task: any) => string
}

function ActivityCard({
  task,
  onComplete,
  onSkip,
  getTaskTypeIcon,
  getActivityCardClass,
  getActivityIconClass
}: ActivityCardProps) {
  const isCompleted = task.status === TaskStatus.COMPLETED
  const isPending = task.status === TaskStatus.PENDING

  return (
    <div className={getActivityCardClass(task)}>
      <div className="activity-header">
        <div className="activity-title">
          <div className={getActivityIconClass(task)}>
            {getTaskTypeIcon(task.type)}
          </div>
          {task.title}
        </div>
        {isPending && (
          <div
            className={`checkbox ${isCompleted ? 'checked' : ''}`}
            onClick={() => onComplete(task.id)}
          ></div>
        )}
      </div>
      <div className="activity-description">
        {task.description}
      </div>
      {task.type === TaskType.ACTIVITY_RESTRICTION && (
        <div className="duration-label">Restriction continues for 7 days</div>
      )}
    </div>
  )
}