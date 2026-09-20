import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Clock,
  Users,
  ArrowRight,
  Search,
  Filter,
  Download,
  Copy,
  Check,
  ExternalLink,
  Building,
  Mail,
  User,
  FileText,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Layers,
  CalendarCheck,
  Eye,
  List,
  Grid,
  Map as MapIcon,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { REGIONAL_EVENTS, RegionalEvent } from "@/data/calendarEventsData";

export function RegionalCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 7, 1)); // August 2026 default
  const [selectedEvent, setSelectedEvent] = useState<RegionalEvent | null>(null);
  const [selectedDayEvents, setSelectedDayEvents] = useState<{ day: number; dateStr: string; events: RegionalEvent[] } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "agenda" | "province">("grid");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProject, setSelectedProject] = useState("ALL");
  const [selectedProvince, setSelectedProvince] = useState("ALL");
  const [selectedType, setSelectedType] = useState("ALL");

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const daysInMonth = getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth());
  const firstDay = getFirstDayOfMonth(currentDate.getFullYear(), currentDate.getMonth());

  const days = useMemo(() => {
    const d = [];
    for (let i = 0; i < firstDay; i++) {
      d.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      d.push(i);
    }
    return d;
  }, [firstDay, daysInMonth]);

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const jumpToMonth = (year: number, month: number) => {
    setCurrentDate(new Date(year, month, 1));
  };

  const jumpToToday = () => {
    setCurrentDate(new Date(2026, 7, 1));
  };

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return REGIONAL_EVENTS.filter((evt) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        evt.title.toLowerCase().includes(q) ||
        evt.location.toLowerCase().includes(q) ||
        evt.venue.toLowerCase().includes(q) ||
        evt.projectName.toLowerCase().includes(q) ||
        evt.focalPerson.toLowerCase().includes(q) ||
        evt.description.toLowerCase().includes(q);

      const matchesProject = selectedProject === "ALL" || evt.projectId === selectedProject;
      const matchesProvince = selectedProvince === "ALL" || evt.province === selectedProvince;
      const matchesType = selectedType === "ALL" || evt.type === selectedType;

      return matchesSearch && matchesProject && matchesProvince && matchesType;
    });
  }, [searchQuery, selectedProject, selectedProvince, selectedType]);

  // Month counts breakdown
  const monthCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    REGIONAL_EVENTS.forEach((e) => {
      const [y, m] = e.date.split("-");
      const key = `${y}-${m}`;
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, []);

  // Helper to check if a day has events in the current month
  const getEventsForDay = (day: number | null) => {
    if (!day) return [];
    const month = (currentDate.getMonth() + 1).toString().padStart(2, "0");
    const dayStr = day.toString().padStart(2, "0");
    const dateStr = `${currentDate.getFullYear()}-${month}-${dayStr}`;

    return filteredEvents.filter((e) => e.date === dateStr);
  };

  // When clicking an event from anywhere, ensure the calendar jumps to that month
  const handleSelectEvent = (event: RegionalEvent) => {
    const [y, m] = event.date.split("-").map(Number);
    if (y && m) {
      setCurrentDate(new Date(y, m - 1, 1));
    }
    setSelectedEvent(event);
  };

  // Generate .ics iCal download
  const handleExportICS = (event: RegionalEvent) => {
    const startDateFormatted = event.date.replace(/-/g, "") + "T090000";
    const endDateFormatted = event.date.replace(/-/g, "") + "T170000";

    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//DICT Region V//Regional Calendar//EN",
      "BEGIN:VEVENT",
      `UID:${event.id}@dict.gov.ph`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
      `DTSTART:${startDateFormatted}`,
      `DTEND:${endDateFormatted}`,
      `SUMMARY:${event.title}`,
      `DESCRIPTION:${event.description.replace(/\n/g, "\\n")}`,
      `LOCATION:${event.venue}, ${event.location}`,
      `STATUS:${event.status.toUpperCase()}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${event.title.toLowerCase().replace(/[^a-z0-9]/g, "_")}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Copy event summary to clipboard
  const handleCopyEventSummary = (event: RegionalEvent) => {
    const summary = `📅 Event: ${event.title}\n` +
      `📌 Project: ${event.projectName}\n` +
      `🗓 Date & Time: ${event.date} | ${event.time}\n` +
      `📍 Venue: ${event.venue}, ${event.location} (${event.province})\n` +
      `👥 Target Audience: ${event.targetAudience}\n` +
      `🏢 Lead Office: ${event.leadOffice} (Focal: ${event.focalPerson})\n\n` +
      `📝 Description:\n${event.description}`;

    navigator.clipboard.writeText(summary);
    setCopiedId(event.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Distinct projects for filter dropdown
  const uniqueProjects = useMemo(() => {
    const map = new Map<string, string>();
    REGIONAL_EVENTS.forEach((e) => {
      if (!map.has(e.projectId)) {
        map.set(e.projectId, e.projectName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, []);

  // Events grouped by Province for Province View
  const eventsByProvince = useMemo(() => {
    const groups: Record<string, RegionalEvent[]> = {
      "Albay": [],
      "Camarines Sur": [],
      "Camarines Norte": [],
      "Catanduanes": [],
      "Masbate": [],
      "Sorsogon": [],
      "Regional": [],
    };
    filteredEvents.forEach((evt) => {
      if (groups[evt.province]) {
        groups[evt.province].push(evt);
      } else {
        groups["Regional"].push(evt);
      }
    });
    return groups;
  }, [filteredEvents]);

  const activeMonthKey = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, "0")}`;
  const eventsThisMonth = filteredEvents.filter((e) => e.date.startsWith(activeMonthKey));

  return (
    <div className="max-w-[1920px] mx-auto text-slate-200 h-full flex flex-col gap-5">
      {/* Main Content Area based on Selected View Mode */}
      {viewMode === "grid" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
          {/* Calendar Grid */}
          <div className="lg:col-span-8 xl:col-span-8 bg-[#0C101A] border border-[#1A2235] rounded-xl flex flex-col overflow-hidden shadow-md">
            {/* Calendar Controls Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#1A2235] bg-[#07090E]">
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-bold text-white tracking-tight">
                  {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                  {eventsThisMonth.length} {eventsThisMonth.length === 1 ? "event" : "events"} this month
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={prevMonth}
                  aria-label="Previous Month"
                  className="p-2 bg-[#111520] hover:bg-[#1A2235] border border-[#1A2235] rounded-lg transition-colors text-slate-400 hover:text-white"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={jumpToToday}
                  className="px-3 py-1.5 rounded-lg bg-[#111520] hover:bg-[#1A2235] border border-[#1A2235] text-xs font-semibold text-slate-300 hover:text-white transition-colors"
                >
                  Current
                </button>
                <button
                  onClick={nextMonth}
                  aria-label="Next Month"
                  className="p-2 bg-[#111520] hover:bg-[#1A2235] border border-[#1A2235] rounded-lg transition-colors text-slate-400 hover:text-white"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Days Header */}
            <div className="grid grid-cols-7 border-b border-[#1A2235] bg-[#0A0D14]">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div
                  key={day}
                  className="py-2.5 text-center text-[11px] font-bold text-slate-400 uppercase tracking-wider"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="flex-1 grid grid-cols-7 auto-rows-fr bg-[#1A2235] gap-[1px]">
              {days.map((day, idx) => {
                const dayEvents = getEventsForDay(day);

                return (
                  <div
                    key={idx}
                    onClick={() => {
                      if (day && dayEvents.length > 0) {
                        const month = (currentDate.getMonth() + 1).toString().padStart(2, "0");
                        const dayStr = day.toString().padStart(2, "0");
                        setSelectedDayEvents({
                          day,
                          dateStr: `${currentDate.getFullYear()}-${month}-${dayStr}`,
                          events: dayEvents,
                        });
                      }
                    }}
                    className={`min-h-[110px] p-2 bg-[#0C101A] transition-colors ${
                      day ? "hover:bg-[#111520] cursor-pointer" : "bg-[#080B12]"
                    } ${dayEvents.length > 0 ? "bg-[#0c1322]" : ""}`}
                  >
                    {day && (
                      <div className="flex flex-col h-full">
                        <div className="flex items-center justify-between mb-1.5">
                          <span
                            className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                              dayEvents.length > 0
                                ? "bg-blue-600 text-white font-mono shadow-sm"
                                : "text-slate-400"
                            }`}
                          >
                            {day}
                          </span>
                          {dayEvents.length > 0 && (
                            <span className="text-[10px] text-blue-400 font-mono font-bold">
                              {dayEvents.length} {dayEvents.length === 1 ? "event" : "events"}
                            </span>
                          )}
                        </div>

                        <div className="space-y-1.5 flex-1 overflow-y-auto max-h-[85px] custom-scrollbar pr-0.5">
                          {dayEvents.map((event) => (
                            <div
                              key={event.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectEvent(event);
                              }}
                              className={`p-1.5 rounded text-[10px] font-medium border border-white/10 ${event.color} bg-opacity-25 text-white cursor-pointer hover:bg-opacity-40 hover:scale-[1.02] transition-all shadow-sm flex flex-col gap-0.5`}
                              title={`${event.title} (${event.time}) - Click for details`}
                            >
                              <span className="font-bold truncate leading-tight">{event.title}</span>
                              <span className="text-[9px] text-slate-300 opacity-90 truncate flex items-center gap-1 font-mono">
                                <Clock className="w-2.5 h-2.5 inline text-blue-300" /> {event.time.split(" - ")[0]}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Upcoming Events Sidebar */}
          <div className="lg:col-span-4 xl:col-span-4 space-y-4">
            <div className="bg-[#0C101A] border border-[#1A2235] rounded-xl p-4 flex flex-col h-full shadow-md">
              <div className="flex items-center justify-between mb-3 pb-3 border-b border-[#1A2235]">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <CalendarCheck className="w-4 h-4 text-blue-400" />
                    Upcoming Events ({filteredEvents.length})
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Click any card to open full details and jump to its month
                  </p>
                </div>
              </div>

              {/* Event Cards Scrollable Container */}
              <div className="space-y-3 flex-1 overflow-y-auto max-h-[620px] pr-1.5 custom-scrollbar">
                {filteredEvents.length === 0 ? (
                  <div className="p-8 text-center bg-[#07090E] border border-dashed border-[#1A2235] rounded-xl text-slate-500 text-xs">
                    <CalendarIcon className="w-8 h-8 mx-auto mb-2 opacity-30 text-slate-400" />
                    No events found matching your filter criteria.
                  </div>
                ) : (
                  filteredEvents
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                    .map((event) => {
                      const eventDate = new Date(event.date);
                      return (
                        <div
                          key={event.id}
                          onClick={() => handleSelectEvent(event)}
                          className="group flex gap-3.5 items-start p-3.5 rounded-xl bg-[#0F1420] border border-[#1A2235] hover:border-blue-500/50 hover:bg-[#151c2d] transition-all cursor-pointer relative shadow-sm hover:shadow-md"
                        >
                          {/* Date Badge */}
                          <div
                            className={`flex flex-col items-center justify-center min-w-[54px] h-[60px] rounded-lg p-1.5 ${event.color} bg-opacity-20 border border-white/10 shrink-0 group-hover:scale-105 transition-transform`}
                          >
                            <span
                              className={`text-[10px] font-bold uppercase tracking-wider ${event.color.replace(
                                "bg-",
                                "text-"
                              )}`}
                            >
                              {monthNames[eventDate.getMonth()].substring(0, 3)}
                            </span>
                            <span className="text-xl font-bold font-mono text-white leading-tight mt-0.5">
                              {eventDate.getDate().toString().padStart(2, "0")}
                            </span>
                          </div>

                          {/* Info Content */}
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[11px] font-bold text-blue-400 truncate">
                                {event.projectName}
                              </span>
                              <span
                                className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${
                                  event.status === "Completed"
                                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                    : event.status === "In Progress"
                                    ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                    : "bg-blue-500/10 text-blue-400 border-blue-500/30"
                                }`}
                              >
                                {event.status}
                              </span>
                            </div>

                            <h4 className="text-xs font-bold text-white group-hover:text-blue-300 transition-colors line-clamp-2 leading-snug">
                              {event.title}
                            </h4>

                            <div className="space-y-1 pt-0.5">
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
                                <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="truncate">{event.time}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
                                <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="truncate">{event.location}</span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-1 border-t border-[#1A2235]/60 text-[10px]">
                              <span className="px-2 py-0.5 rounded bg-[#1A2235] text-slate-200 font-medium">
                                {event.type}
                              </span>
                              <span className="flex items-center gap-1 text-slate-300 font-mono font-medium">
                                <Users className="w-3 h-3 text-slate-400" /> {event.attendees} Pax
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Agenda / Chronological All-Events View */}
      {viewMode === "agenda" && (
        <div className="bg-[#0C101A] border border-[#1A2235] rounded-xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#1A2235]">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <List className="w-5 h-5 text-blue-400" />
                Comprehensive Master Schedule (All Months)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Full chronological sequence of all scheduled deployments, exams, trainings, and field inspections.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
              {filteredEvents.length} Events Total
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEvents
              .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
              .map((event) => {
                const eventDate = new Date(event.date);
                return (
                  <div
                    key={event.id}
                    onClick={() => handleSelectEvent(event)}
                    className="p-4 rounded-xl bg-[#0F1420] border border-[#1A2235] hover:border-blue-500/60 hover:bg-[#151c2d] transition-all cursor-pointer flex flex-col justify-between gap-3 shadow group"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-blue-500/15 text-blue-400 border border-blue-500/30">
                          {event.projectName}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            event.status === "Completed"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : event.status === "In Progress"
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                              : "bg-blue-500/10 text-blue-400 border-blue-500/30"
                          }`}
                        >
                          {event.status}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-white group-hover:text-blue-300 transition-colors leading-snug">
                        {event.title}
                      </h4>

                      <div className="space-y-1.5 text-xs text-slate-300 pt-1">
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          <span className="font-mono font-medium">{event.date} ({monthNames[eventDate.getMonth()]})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{event.time}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="truncate">{event.venue}, {event.location}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                          <span className="truncate">Focal: {event.focalPerson}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[#1A2235] text-xs">
                      <span className="px-2 py-0.5 rounded bg-[#1A2235] text-slate-300 text-[11px] font-medium">
                        {event.province} • {event.type}
                      </span>
                      <span className="text-blue-400 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-1 text-[11px]">
                        Details <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* By Province View */}
      {viewMode === "province" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {(Object.entries(eventsByProvince) as [string, RegionalEvent[]][]).map(([provinceName, pEvents]) => (
              <div
                key={provinceName}
                className="bg-[#0C101A] border border-[#1A2235] rounded-xl p-4 flex flex-col gap-3 shadow-md"
              >
                <div className="flex items-center justify-between pb-2.5 border-b border-[#1A2235]">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-blue-400" />
                    <h4 className="text-sm font-bold text-white">{provinceName}</h4>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-[#111520] text-blue-400 border border-[#1A2235]">
                    {pEvents.length} {pEvents.length === 1 ? "Event" : "Events"}
                  </span>
                </div>

                {pEvents.length === 0 ? (
                  <div className="p-4 text-center text-slate-500 text-xs italic">
                    No scheduled events in this province.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {pEvents.map((evt) => (
                      <div
                        key={evt.id}
                        onClick={() => handleSelectEvent(evt)}
                        className="p-3 rounded-lg bg-[#0F1420] border border-[#1A2235] hover:border-blue-500/50 hover:bg-[#151c2d] cursor-pointer transition-all space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-1 text-[10px]">
                          <span className="font-bold text-blue-400 font-mono">{evt.date}</span>
                          <span className="px-1.5 py-0.2 rounded bg-[#1A2235] text-slate-300 font-medium">
                            {evt.type}
                          </span>
                        </div>
                        <h5 className="text-xs font-bold text-white hover:text-blue-300 transition-colors leading-snug">
                          {evt.title}
                        </h5>
                        <p className="text-[11px] text-slate-400 truncate flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                          {evt.venue}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Day Events Overview Modal (When clicking a day cell on the calendar) */}
      {selectedDayEvents && (
        <Modal
          isOpen={!!selectedDayEvents}
          onClose={() => setSelectedDayEvents(null)}
          title={`Scheduled Events: ${selectedDayEvents.dateStr}`}
          className="max-w-xl"
        >
          <div className="space-y-4 text-sm">
            <p className="text-xs text-slate-400">
              There are {selectedDayEvents.events.length} regional operation(s) scheduled for this date. Click an event to view full details.
            </p>
            <div className="space-y-3">
              {selectedDayEvents.events.map((evt) => (
                <div
                  key={evt.id}
                  onClick={() => {
                    setSelectedDayEvents(null);
                    setSelectedEvent(evt);
                  }}
                  className="p-3.5 rounded-xl bg-[#0F1420] border border-[#1A2235] hover:border-blue-500 hover:bg-[#151c2d] transition-all cursor-pointer space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-blue-500/15 text-blue-400 border border-blue-500/30">
                      {evt.projectName}
                    </span>
                    <span className="text-xs font-bold text-white font-mono">{evt.time}</span>
                  </div>
                  <h4 className="text-sm font-bold text-white">{evt.title}</h4>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{evt.venue}, {evt.location}</span>
                    <span className="font-semibold text-blue-400">View Dossier →</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedDayEvents(null)}
                className="px-4 py-2 rounded-lg bg-[#111520] hover:bg-[#1A2235] text-slate-300 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Comprehensive Event Details Modal */}
      {selectedEvent && (
        <Modal
          isOpen={!!selectedEvent}
          onClose={() => setSelectedEvent(null)}
          title={`Event Dossier: ${selectedEvent.title}`}
          className="max-w-2xl"
        >
          <div className="space-y-5 text-sm">
            {/* Header Banner Card */}
            <div className="p-4 rounded-xl border border-blue-500/30 bg-[#07090E] relative overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase bg-blue-500/15 text-blue-400 border border-blue-500/30">
                    {selectedEvent.projectName}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-purple-500/15 text-purple-400 border border-purple-500/30">
                    {selectedEvent.type}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-500/15 text-slate-300 border border-slate-500/30">
                    {selectedEvent.mode}
                  </span>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded text-[10px] font-bold border ${
                    selectedEvent.status === "Completed"
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                      : selectedEvent.status === "In Progress"
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                      : "bg-blue-500/10 text-blue-400 border-blue-500/30"
                  }`}
                >
                  ● {selectedEvent.status}
                </span>
              </div>

              <h3 className="text-base font-bold text-white tracking-tight">{selectedEvent.title}</h3>
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-blue-400" />
                {selectedEvent.venue}, {selectedEvent.location} ({selectedEvent.province})
              </p>
            </div>

            {/* Quick Metadata Matrix Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-[#0C101A] border border-[#1A2235] rounded-lg">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Schedule Date</span>
                <span className="text-xs font-bold text-white font-mono flex items-center gap-1 mt-0.5">
                  <CalendarIcon className="w-3 h-3 text-blue-400" />
                  {selectedEvent.date}
                </span>
              </div>
              <div className="p-3 bg-[#0C101A] border border-[#1A2235] rounded-lg">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Time Duration</span>
                <span className="text-xs font-bold text-white font-mono flex items-center gap-1 mt-0.5">
                  <Clock className="w-3 h-3 text-blue-400" />
                  {selectedEvent.time}
                </span>
              </div>
              <div className="p-3 bg-[#0C101A] border border-[#1A2235] rounded-lg">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Expected Attendance</span>
                <span className="text-xs font-bold text-emerald-400 font-mono flex items-center gap-1 mt-0.5">
                  <Users className="w-3 h-3 text-emerald-400" />
                  {selectedEvent.attendees} {selectedEvent.expectedAttendees ? `/ ${selectedEvent.expectedAttendees}` : ""} Pax
                </span>
              </div>
            </div>

            {/* Administrative Coordination & Leads */}
            <div className="bg-[#0C101A] p-4 rounded-xl border border-[#1A2235] space-y-2.5 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-[#1A2235] pb-2">
                <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                  <Building className="w-3.5 h-3.5 text-slate-500" /> Lead Office:
                </span>
                <span className="font-semibold text-white">{selectedEvent.leadOffice}</span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-[#1A2235] pb-2">
                <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                  <User className="w-3.5 h-3.5 text-slate-500" /> Focal Person / Speaker:
                </span>
                <span className="font-semibold text-slate-200">{selectedEvent.focalPerson}</span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                  <Users className="w-3.5 h-3.5 text-slate-500" /> Target Beneficiaries:
                </span>
                <span className="font-medium text-slate-300">{selectedEvent.targetAudience}</span>
              </div>

              {selectedEvent.saroRef && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pt-2 border-t border-[#1A2235]">
                  <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                    <FileText className="w-3.5 h-3.5 text-purple-400" /> Budget Reference:
                  </span>
                  <span className="font-mono text-purple-400 font-bold">{selectedEvent.saroRef}</span>
                </div>
              )}
            </div>

            {/* Scope & Description */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Event Overview & Scope</h4>
              <p className="text-xs text-slate-300 leading-relaxed bg-[#07090E] p-3.5 rounded-lg border border-[#1A2235]">
                {selectedEvent.description}
              </p>
            </div>

            {/* Agenda Timeline */}
            {selectedEvent.agenda && selectedEvent.agenda.length > 0 && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-400" /> Program Agenda & Schedule
                </h4>
                <div className="space-y-1.5 bg-[#07090E] p-3.5 rounded-lg border border-[#1A2235]">
                  {selectedEvent.agenda.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Requirements & Checklist */}
            {selectedEvent.requirements && selectedEvent.requirements.length > 0 && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Participant Requirements
                </h4>
                <div className="space-y-1.5 bg-[#07090E] p-3.5 rounded-lg border border-[#1A2235]">
                  {selectedEvent.requirements.map((req, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-slate-300">
                      <span className="text-emerald-400 font-bold">✓</span>
                      <span>{req}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Bar Footer */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-[#1A2235]">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExportICS(selectedEvent)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#1A2235] hover:bg-[#25304b] text-slate-200 text-xs font-semibold transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-blue-400" />
                  Add to Calendar (.ics)
                </button>
                <button
                  onClick={() => handleCopyEventSummary(selectedEvent)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#1A2235] hover:bg-[#25304b] text-slate-200 text-xs font-semibold transition-colors"
                >
                  {copiedId === selectedEvent.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                      Copy Info
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  to={`/projects/${selectedEvent.projectId}`}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Project Analytics
                </Link>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="px-4 py-2 rounded-lg bg-[#111520] hover:bg-[#1A2235] text-slate-300 text-xs font-semibold transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
