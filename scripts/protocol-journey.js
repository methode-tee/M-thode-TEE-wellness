
// Dynamic milestones according to protocol duration
function buildMilestones(totalDays) {
  if (totalDays <= 5) {
    return [1,3,5];
  } else if (totalDays <= 7) {
    return [1,3,5,7];
  } else if (totalDays <= 14) {
    return [1,3,7,14];
  } else if (totalDays <= 21) {
    return [1,7,14,21];
  } else {
    return [1,7,14,21,28];
  }
}

// Inject dynamic milestones
window.buildMilestones = buildMilestones;
