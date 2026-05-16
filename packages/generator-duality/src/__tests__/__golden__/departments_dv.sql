CREATE OR REPLACE JSON RELATIONAL DUALITY VIEW hr.departments_dv AS
SELECT JSON {
  '_id' : d.deptno,
  'departmentName' : d.dname,
  'location' : d.loc,
  'employees' : [ SELECT JSON {
    'employeeNumber' : e.empno,
    'employeeName' : e.ename,
    'job' : e.job,
    'salary' : e.sal
  } FROM emp e WITH INSERT UPDATE DELETE WHERE e.deptno = d.deptno ]
}
FROM dept d WITH INSERT UPDATE DELETE;