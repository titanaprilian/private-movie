---- MODULE ArchiveIngestCapacity ----
EXTENDS Naturals, TLC

CONSTANTS MaxActive, AtomicAdmission

Actors == {"requestA", "requestB"}

VARIABLES active, phase, admitted
vars == <<active, phase, admitted>>

Init ==
  /\ MaxActive \in Nat \ {0}
  /\ active = MaxActive - 1
  /\ phase = [a \in Actors |-> "checking"]
  /\ admitted = [a \in Actors |-> FALSE]

CheckCapacity(a) ==
  /\ ~AtomicAdmission
  /\ a \in Actors
  /\ phase[a] = "checking"
  /\ phase' = [phase EXCEPT ![a] = "checked"]
  /\ admitted' = [admitted EXCEPT ![a] = active < MaxActive]
  /\ UNCHANGED active

AtomicAdmit(a) ==
  /\ AtomicAdmission
  /\ a \in Actors
  /\ phase[a] = "checking"
  /\ active < MaxActive
  /\ active' = active + 1
  /\ phase' = [phase EXCEPT ![a] = "done"]
  /\ admitted' = [admitted EXCEPT ![a] = TRUE]

AtomicStayQueued(a) ==
  /\ AtomicAdmission
  /\ a \in Actors
  /\ phase[a] = "checking"
  /\ active >= MaxActive
  /\ phase' = [phase EXCEPT ![a] = "done"]
  /\ admitted' = [admitted EXCEPT ![a] = FALSE]
  /\ UNCHANGED active
StartDownload(a) ==
  /\ ~AtomicAdmission
  /\ a \in Actors
  /\ phase[a] = "checked"
  /\ admitted[a]
  /\ active' = active + 1
  /\ phase' = [phase EXCEPT ![a] = "done"]
  /\ UNCHANGED admitted

StayQueued(a) ==
  /\ ~AtomicAdmission
  /\ a \in Actors
  /\ phase[a] = "checked"
  /\ ~admitted[a]
  /\ phase' = [phase EXCEPT ![a] = "done"]
  /\ UNCHANGED <<active, admitted>>

Next ==
  \/ \E a \in Actors : CheckCapacity(a)
  \/ \E a \in Actors : AtomicAdmit(a)
  \/ \E a \in Actors : AtomicStayQueued(a)
  \/ \E a \in Actors : StartDownload(a)
  \/ \E a \in Actors : StayQueued(a)

TypeOK ==
  /\ active \in Nat
  /\ phase \in [Actors -> {"checking", "checked", "done"}]
  /\ admitted \in [Actors -> BOOLEAN]

ActiveWithinLimit == active <= MaxActive

Spec == Init /\ [][Next]_vars

====
