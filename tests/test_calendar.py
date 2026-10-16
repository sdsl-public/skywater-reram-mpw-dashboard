"""Exercise the actual browser calendar functions with Node, without third-party packages."""
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

class CalendarTests(unittest.TestCase):
    def run_calendar(self, assertions: str, reverse: bool = False) -> subprocess.CompletedProcess:
        config = (ROOT / 'site/config.js').read_text()
        if reverse:
            config = config.replace("projectEnd: '2027-09-30'", "projectEnd: '2026-09-30'")
        app = (ROOT / 'site/app.js').read_text()
        prefix = app[:app.index('  const state=')]
        geometry = app[app.index('  function timeGeometry()'):app.index('  function gridMarkup(')]
        script = "global.window={};\n" + config + '\n' + prefix
        script += "\nconst state={scale:'full',start:projectFirstMonth};\n" + geometry
        script += "\nconst assert=require('node:assert/strict');\n" + assertions + '\n})();'
        return subprocess.run(['node', '-e', script], capture_output=True, text=True, timeout=10)

    def test_fixed_year_zoom_bounds_and_example_dates(self):
        result = self.run_calendar("""
          assert.equal(projectMonths,12);
          assert.equal(projectDays,365);
          assert.equal(dayKey(projectStart),'2026-10-01');
          assert.equal(dayKey(projectEnd),'2027-09-30');
          let geo=timeGeometry();
          assert.equal(geo.months.length,12);
          assert.equal(geo.days,365);
          assert.equal(dayKey(geo.end),'2027-10-01');
          assert.equal(geo.ticks.length,24);
          assert(Math.abs(geo.months.reduce((sum,m)=>sum+m.width,0)-100)<1e-9);
          assert.equal(dayKey(clampStart(parseDay('2028-01-01'))),'2026-10-01');
          state.scale='month';
          assert.equal(visibleMonths(),6);
          state.start=clampStart(parseDay('2027-09-01'));
          assert.equal(dayKey(state.start),'2027-04-01');
          assert.equal(dayKey(timeGeometry().end),'2027-10-01');
          state.scale='week';
          state.start=clampStart(parseDay('2028-01-01'));
          assert.equal(dayKey(state.start),'2027-07-01');
          assert.equal(timeGeometry().months.length,3);
          assert.equal(dayKey(clampStart(parseDay('2020-01-01'))),'2026-10-01');
          assert.equal(demoTasks.length,18);
          assert.equal(demoTasks[0].start,'2026-10-01');
          assert.equal(demoTasks.at(-1).end,'2027-09-30');
          assert(demoTasks.every(t=>t.start>=config.projectStart && t.end<=config.projectEnd));
          assert.equal(realTasks.length,0);
        """)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_reversed_dates_are_rejected_not_silently_swapped(self):
        result = self.run_calendar('', reverse=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('end must not precede the start', result.stderr)

if __name__ == '__main__':
    unittest.main()
