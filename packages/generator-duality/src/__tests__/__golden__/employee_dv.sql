CREATE OR REPLACE JSON RELATIONAL DUALITY VIEW hr.employee_dv AS
SELECT JSON {
  '_id' : e.empno,
  'employeeName' : e.ename,
  'job' : e.job,
  'salary' : e.sal,
  UNNEST ( SELECT JSON {
    'departmentNumber' : d.deptno,
    'departmentName' : d.dname,
    'location' : d.loc
  } FROM dept d WITH UPDATE WHERE d.deptno = e.deptno )
}
FROM emp e WITH INSERT UPDATE DELETE;