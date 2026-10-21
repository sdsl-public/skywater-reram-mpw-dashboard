"""Exercise reusable calendar behavior for arbitrary configured project windows."""
import subprocess
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

class CalendarTests(unittest.TestCase):
    def run_calendar(self, assertions: str, reverse: bool=False) -> subprocess.CompletedProcess:
        config=(ROOT/'site/config.js').read_text(encoding='utf-8')
        if reverse:
            import re
            config=re.sub(r"projectEnd: '\d{4}-\d{2}-\d{2}'",
                          "projectEnd: '1999-01-01'",config,count=1)
        app=(ROOT/'site/app.js').read_text(encoding='utf-8')
        prefix=app[:app.index('  const state=')]
        geometry=app[app.index('  function timeGeometry()'):app.index('  function gridMarkup(')]
        script="global.window={};\n"+config+"\n"+prefix
        script+="\nconst state={scale:'full',start:projectFirstMonth};\n"+geometry
        script+="\nconst assert=require('node:assert/strict');\n"+assertions+"\n})();"
        return subprocess.run(['node','-e',script],capture_output=True,text=True,timeout=10)

    def test_calendar_tracks_configured_dates_and_zoom_bounds(self):
        result=self.run_calendar("""
          const months=(projectEnd.getUTCFullYear()-projectStart.getUTCFullYear())*12+
            projectEnd.getUTCMonth()-projectStart.getUTCMonth()+1;
          assert.equal(projectMonths,months);
          assert.equal(dayKey(projectStart),config.projectStart);
          assert.equal(dayKey(projectEnd),config.projectEnd);
          assert.equal(projectDays,Math.round((projectEnd-projectStart)/DAY)+1);
          let geo=timeGeometry();
          assert.equal(geo.months.length,projectMonths);
          assert.equal(geo.ticks.length,projectMonths*2);
          assert(Math.abs(geo.months.reduce((total,m)=>total+m.width,0)-100)<1e-7);
          assert.equal(dayKey(clampStart(parseDay('2000-01-01'))),
            dayKey(projectFirstMonth));
          state.scale='month';
          assert.equal(visibleMonths(),Math.min(6,projectMonths));
          state.start=clampStart(projectEnd);
          assert.equal(dayKey(timeGeometry().end),dayKey(projectEndExclusive));
          state.scale='week';
          assert.equal(visibleMonths(),Math.min(3,projectMonths));
          assert.equal(dayKey(clampStart(parseDay('2000-01-01'))),dayKey(projectFirstMonth));
          assert.equal(demoTasks.length,18);
          assert.equal(demoTasks[0].start,config.projectStart);
          assert.equal(demoTasks.at(-1).end,config.projectEnd);
          assert(demoTasks.every(t=>t.start>=config.projectStart && t.end<=config.projectEnd));
          assert.equal(realTasks.length,0);
        """)
        self.assertEqual(result.returncode,0,result.stderr)

    def test_reversed_dates_are_rejected(self):
        result=self.run_calendar('',reverse=True)
        self.assertNotEqual(result.returncode,0)
        self.assertIn('end must not precede the start',result.stderr)

if __name__=='__main__':
    unittest.main()
